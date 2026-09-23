package com.flux.service.matching;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flux.model.SharedTrip;
import com.flux.model.SharedTripMember;
import com.flux.model.TripRequest;

@Component
public class BasicMatchingStrategy implements MatchingStrategy {

    private static final double COMPATIBILITY_THRESHOLD = 0.50;
    private static final long MAX_TIME_DIFFERENCE_MINUTES = 60;
    private static final double MAX_DESTINATION_GAP_KM = 5.0;
    private static final double ROUTE_CORRIDOR_KM = 1.5;
    private static final double MAX_USEFUL_DETOUR_KM = 6.0;

    private static final Pattern NON_ALPHANUMERIC =
            Pattern.compile("[^a-z0-9\\s]");

    private final ObjectMapper objectMapper;

    public BasicMatchingStrategy(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public CompatibilityResult calculateCompatibility(
            TripRequest tripRequest,
            SharedTrip sharedTrip) {

        if (hasGeographicData(tripRequest, sharedTrip)) {
            return calculateGeographicCompatibility(tripRequest, sharedTrip);
        }

        return calculateLegacyCompatibility(tripRequest, sharedTrip);
    }

    private CompatibilityResult calculateGeographicCompatibility(
            TripRequest request,
            SharedTrip sharedTrip) {

        List<String> reasons = new ArrayList<>();

        double destinationGapKm = distanceKm(
                request.getDropLatitude(),
                request.getDropLongitude(),
                sharedTrip.getDestinationLatitude(),
                sharedTrip.getDestinationLongitude()
        );

        double destinationScore = clamp01(
                1.0 - (destinationGapKm / MAX_DESTINATION_GAP_KM)
        );

        boolean destinationCompatible =
                destinationGapKm <= MAX_DESTINATION_GAP_KM;

        if (destinationCompatible) {
            reasons.add(String.format(
                    "Destination within %.1f km",
                    destinationGapKm
            ));
        }

        double timeScore = calculateTimeCompatibility(request, sharedTrip);
        boolean timeCompatible = timeScore > 0.0;

        if (timeCompatible) {
            reasons.add("Compatible departure time");
        }

        double routeOverlapScore = calculateRouteOverlap(
                request.getRouteGeometry(),
                sharedTrip.getRouteGeometry()
        );

        Double estimatedDetourKm =
                estimatePickupDetourKm(request, sharedTrip);

        double pickupScore;
        if (estimatedDetourKm != null) {
            pickupScore = clamp01(
                    1.0 - (estimatedDetourKm / MAX_USEFUL_DETOUR_KM)
            );
        } else {
            pickupScore = calculateBestPickupProximity(
                    request,
                    sharedTrip
            );
        }

        /*
         * If one of the routes is missing, geographic pickup proximity
         * provides a safe fallback for the route component.
         */
        double effectiveRouteScore =
                routeOverlapScore > 0.0
                        ? routeOverlapScore
                        : pickupScore;

        if (routeOverlapScore > 0.0) {
            reasons.add(String.format(
                    "%.0f%% route overlap",
                    routeOverlapScore * 100.0
            ));
        }

        if (estimatedDetourKm != null) {
            reasons.add(String.format(
                    "Estimated pickup detour %.1f km",
                    estimatedDetourKm
            ));
        }

        /*
         * Geographic matching weights:
         * destination proximity = 30%
         * route overlap          = 35%
         * pickup detour          = 20%
         * departure time         = 15%
         */
        double score =
                destinationScore * 0.30
                        + effectiveRouteScore * 0.35
                        + pickupScore * 0.20
                        + timeScore * 0.15;

        score = Math.round(score * 100.0) / 100.0;

        boolean routeCompatible =
                routeOverlapScore >= 0.25
                        || (estimatedDetourKm != null
                        && estimatedDetourKm <= MAX_USEFUL_DETOUR_KM)
                        || pickupScore >= 0.35;

        boolean compatible =
                destinationCompatible
                        && timeCompatible
                        && routeCompatible
                        && score >= COMPATIBILITY_THRESHOLD;

        return new CompatibilityResult(
                score,
                compatible,
                reasons,
                Math.round(routeOverlapScore * 100.0) / 100.0,
                estimatedDetourKm == null
                        ? null
                        : Math.round(estimatedDetourKm * 10.0) / 10.0
        );
    }

    private CompatibilityResult calculateLegacyCompatibility(
            TripRequest tripRequest,
            SharedTrip sharedTrip) {

        List<String> reasons = new ArrayList<>();

        boolean destinationMatches =
                normalize(tripRequest.getDrop())
                        .equals(normalize(sharedTrip.getDestination()));

        if (destinationMatches) {
            reasons.add("Same destination");
        }

        double bestPickupScore = 0.0;
        for (SharedTripMember member : sharedTrip.getMembers()) {
            bestPickupScore = Math.max(
                    bestPickupScore,
                    calculateTextSimilarity(
                            tripRequest.getPickup(),
                            member.getPickup()
                    )
            );
        }

        if (bestPickupScore >= 0.5) {
            reasons.add("Similar pickup route");
        }

        double timeScore =
                calculateTimeCompatibility(
                        tripRequest,
                        sharedTrip
                );

        boolean timeCompatible = timeScore > 0.0;

        if (timeCompatible) {
            reasons.add("Compatible departure time");
        }

        double destinationScore =
                destinationMatches ? 1.0 : 0.0;

        double score =
                destinationScore * 0.50
                        + bestPickupScore * 0.30
                        + timeScore * 0.20;

        score = Math.round(score * 100.0) / 100.0;

        return new CompatibilityResult(
                score,
                destinationMatches
                        && timeCompatible
                        && score >= COMPATIBILITY_THRESHOLD,
                reasons,
                0.0,
                null
        );
    }

    private boolean hasGeographicData(
            TripRequest request,
            SharedTrip sharedTrip) {

        return validCoordinate(request.getPickupLatitude())
                && validCoordinate(request.getPickupLongitude())
                && validCoordinate(request.getDropLatitude())
                && validCoordinate(request.getDropLongitude())
                && validCoordinate(sharedTrip.getDestinationLatitude())
                && validCoordinate(sharedTrip.getDestinationLongitude());
    }

    private boolean validCoordinate(Double value) {
        return value != null && Double.isFinite(value);
    }

    private double calculateBestPickupProximity(
            TripRequest request,
            SharedTrip sharedTrip) {

        double best = 0.0;

        for (SharedTripMember member : sharedTrip.getMembers()) {
            if (!validCoordinate(member.getPickupLatitude())
                    || !validCoordinate(member.getPickupLongitude())) {
                continue;
            }

            double gap = distanceKm(
                    request.getPickupLatitude(),
                    request.getPickupLongitude(),
                    member.getPickupLatitude(),
                    member.getPickupLongitude()
            );

            best = Math.max(
                    best,
                    clamp01(1.0 - gap / 8.0)
            );
        }

        return best;
    }

    private Double estimatePickupDetourKm(
            TripRequest request,
            SharedTrip sharedTrip) {

        if (!validCoordinate(request.getPickupLatitude())
                || !validCoordinate(request.getPickupLongitude())) {
            return null;
        }

        List<double[]> route =
                parseRoute(sharedTrip.getRouteGeometry());

        if (!route.isEmpty()) {
            double nearest = Double.MAX_VALUE;

            for (int index = 0;
                    index < route.size();
                    index += Math.max(1, route.size() / 40)) {

                double[] point = route.get(index);

                nearest = Math.min(
                        nearest,
                        distanceKm(
                                request.getPickupLatitude(),
                                request.getPickupLongitude(),
                                point[1],
                                point[0]
                        )
                );
            }

            if (nearest < Double.MAX_VALUE) {
                /*
                 * Approximate diversion out to the pickup and back
                 * to the group's route corridor.
                 */
                return nearest * 2.0;
            }
        }

        double nearestMember = Double.MAX_VALUE;

        for (SharedTripMember member : sharedTrip.getMembers()) {
            if (!validCoordinate(member.getPickupLatitude())
                    || !validCoordinate(member.getPickupLongitude())) {
                continue;
            }

            nearestMember = Math.min(
                    nearestMember,
                    distanceKm(
                            request.getPickupLatitude(),
                            request.getPickupLongitude(),
                            member.getPickupLatitude(),
                            member.getPickupLongitude()
                    )
            );
        }

        return nearestMember == Double.MAX_VALUE
                ? null
                : nearestMember;
    }

    private double calculateRouteOverlap(
            String firstGeometry,
            String secondGeometry) {

        List<double[]> first = parseRoute(firstGeometry);
        List<double[]> second = parseRoute(secondGeometry);

        if (first.isEmpty() || second.isEmpty()) {
            return 0.0;
        }

        int samples = 0;
        int insideCorridor = 0;
        int step = Math.max(1, first.size() / 30);

        for (int index = 0; index < first.size(); index += step) {
            double[] point = first.get(index);
            samples++;

            if (distanceToRouteKm(point, second)
                    <= ROUTE_CORRIDOR_KM) {
                insideCorridor++;
            }
        }

        return samples == 0
                ? 0.0
                : (double) insideCorridor / samples;
    }

    private double distanceToRouteKm(
            double[] point,
            List<double[]> route) {

        double nearest = Double.MAX_VALUE;
        int step = Math.max(1, route.size() / 60);

        for (int index = 0; index < route.size(); index += step) {
            double[] candidate = route.get(index);

            nearest = Math.min(
                    nearest,
                    distanceKm(
                            point[1],
                            point[0],
                            candidate[1],
                            candidate[0]
                    )
            );
        }

        return nearest;
    }

    private List<double[]> parseRoute(String geometry) {

        List<double[]> points = new ArrayList<>();

        if (geometry == null || geometry.isBlank()) {
            return points;
        }

        try {
            JsonNode root = objectMapper.readTree(geometry);

            if (!root.isArray()) {
                return points;
            }

            for (JsonNode node : root) {
                if (node.isArray()
                        && node.size() >= 2
                        && node.get(0).isNumber()
                        && node.get(1).isNumber()) {

                    points.add(new double[] {
                            node.get(0).asDouble(),
                            node.get(1).asDouble()
                    });
                }
            }
        } catch (Exception ignored) {
            return new ArrayList<>();
        }

        return points;
    }

    private double calculateTimeCompatibility(
            TripRequest tripRequest,
            SharedTrip sharedTrip) {

        if (tripRequest.getDepartureTime() == null
                || sharedTrip.getDepartureTime() == null) {
            return 0.0;
        }

        long differenceMinutes =
                Math.abs(
                        Duration.between(
                                tripRequest.getDepartureTime(),
                                sharedTrip.getDepartureTime()
                        ).toMinutes()
                );

        if (differenceMinutes >= MAX_TIME_DIFFERENCE_MINUTES) {
            return 0.0;
        }

        return 1.0
                - ((double) differenceMinutes
                / MAX_TIME_DIFFERENCE_MINUTES);
    }

    private double calculateTextSimilarity(
            String firstLocation,
            String secondLocation) {

        Set<String> firstWords = toWordSet(firstLocation);
        Set<String> secondWords = toWordSet(secondLocation);

        if (firstWords.isEmpty() || secondWords.isEmpty()) {
            return 0.0;
        }

        Set<String> intersection =
                new HashSet<>(firstWords);
        intersection.retainAll(secondWords);

        Set<String> union =
                new HashSet<>(firstWords);
        union.addAll(secondWords);

        return (double) intersection.size()
                / union.size();
    }

    private Set<String> toWordSet(String location) {
        String normalized = normalize(location);
        Set<String> words =
                new HashSet<>(
                        Arrays.asList(
                                normalized.split(" ")
                        )
                );
        words.remove("");
        return words;
    }

    private String normalize(String text) {
        if (text == null) return "";
        String lower = text.trim().toLowerCase();
        String stripped =
                NON_ALPHANUMERIC
                        .matcher(lower)
                        .replaceAll(" ");
        return stripped.trim().replaceAll("\\s+", " ");
    }

    private double clamp01(double value) {
        return Math.max(0.0, Math.min(1.0, value));
    }

    private double distanceKm(
            double lat1,
            double lon1,
            double lat2,
            double lon2) {

        final double earthRadiusKm = 6371.0088;

        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double firstLat = Math.toRadians(lat1);
        double secondLat = Math.toRadians(lat2);

        double a =
                Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0)
                        + Math.cos(firstLat)
                        * Math.cos(secondLat)
                        * Math.sin(dLon / 2.0)
                        * Math.sin(dLon / 2.0);

        return earthRadiusKm
                * 2.0
                * Math.atan2(
                        Math.sqrt(a),
                        Math.sqrt(1.0 - a)
                );
    }
}
