package com.flux.service.matching;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.flux.model.SharedTrip;
import com.flux.model.SharedTripMember;
import com.flux.model.TripRequest;

/**
 * Basic implementation of the FLUX RIDE matching algorithm.
 *
 * Currently considers:
 * 1. Destination compatibility
 * 2. Pickup-route similarity
 * 3. Departure-time compatibility
 */
@Component
public class BasicMatchingStrategy implements MatchingStrategy {

    private static final double ROUTE_MATCH_THRESHOLD = 0.5;
    private static final double COMPATIBILITY_THRESHOLD = 0.5;

    /*
     * Passengers travelling within 60 minutes of each other
     * are considered time-compatible.
     */
    private static final long MAX_TIME_DIFFERENCE_MINUTES = 60;

    private static final Pattern NON_ALPHANUMERIC =
            Pattern.compile("[^a-z0-9\\s]");

    @Override
    public CompatibilityResult calculateCompatibility(
            TripRequest tripRequest,
            SharedTrip sharedTrip) {

        List<String> reasons = new ArrayList<>();

        /*
         * -------------------------------------------------
         * 1. DESTINATION COMPATIBILITY
         * -------------------------------------------------
         */

        String requestDestination =
                normalize(tripRequest.getDrop());

        String sharedDestination =
                normalize(sharedTrip.getDestination());

        boolean destinationMatches =
                requestDestination.equals(sharedDestination);

        if (destinationMatches) {
            reasons.add("Same destination");
        }

        /*
         * -------------------------------------------------
         * 2. PICKUP-ROUTE SIMILARITY
         * -------------------------------------------------
         */

        double bestPickupScore = 0.0;

        for (SharedTripMember member :
                sharedTrip.getMembers()) {

            double pickupScore =
                    calculateRouteSimilarity(
                            tripRequest.getPickup(),
                            member.getPickup()
                    );

            bestPickupScore =
                    Math.max(
                            bestPickupScore,
                            pickupScore
                    );
        }

        if (bestPickupScore >= ROUTE_MATCH_THRESHOLD) {
            reasons.add("Similar pickup route");
        }

        /*
         * -------------------------------------------------
         * 3. DEPARTURE-TIME COMPATIBILITY
         * -------------------------------------------------
         */

        double timeScore =
                calculateTimeCompatibility(
                        tripRequest,
                        sharedTrip
                );

        boolean timeCompatible =
                timeScore > 0.0;

        if (timeCompatible) {
            reasons.add("Compatible departure time");
        }

        /*
         * -------------------------------------------------
         * FINAL COMPATIBILITY SCORE
         * -------------------------------------------------
         *
         * Destination = 50%
         * Pickup route = 30%
         * Departure time = 20%
         */

        double destinationScore =
                destinationMatches ? 1.0 : 0.0;

        double compatibilityScore =
                (destinationScore * 0.50)
                        + (bestPickupScore * 0.30)
                        + (timeScore * 0.20);

        compatibilityScore =
                Math.round(
                        compatibilityScore * 100.0
                ) / 100.0;

        /*
         * Hard matching requirements:
         *
         * 1. Destination must match.
         * 2. Departure time must be within the allowed window.
         * 3. Overall compatibility must reach the minimum score.
         *
         * This prevents passengers travelling to the same
         * destination at very different times from being matched.
         */
        boolean compatible =
                destinationMatches
                        && timeCompatible
                        && compatibilityScore
                        >= COMPATIBILITY_THRESHOLD;

        return new CompatibilityResult(
                compatibilityScore,
                compatible,
                reasons
        );
    }

    /**
     * Calculates departure-time compatibility.
     *
     * Same time       -> score 1.0
     * 30 minutes away -> score 0.5
     * 60+ minutes     -> score 0.0
     */
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

        if (differenceMinutes
                >= MAX_TIME_DIFFERENCE_MINUTES) {

            return 0.0;
        }

        return 1.0
                - ((double) differenceMinutes
                / MAX_TIME_DIFFERENCE_MINUTES);
    }

    /**
     * Calculates Jaccard similarity between location words.
     */
    private double calculateRouteSimilarity(
            String firstLocation,
            String secondLocation) {

        Set<String> firstWords =
                toWordSet(firstLocation);

        Set<String> secondWords =
                toWordSet(secondLocation);

        if (firstWords.isEmpty()
                || secondWords.isEmpty()) {

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

        String normalized =
                normalize(location);

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

        if (text == null) {
            return "";
        }

        String lower =
                text.trim().toLowerCase();

        String stripped =
                NON_ALPHANUMERIC
                        .matcher(lower)
                        .replaceAll(" ");

        return stripped
                .trim()
                .replaceAll("\\s+", " ");
    }
}