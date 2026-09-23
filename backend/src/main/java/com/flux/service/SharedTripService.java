package com.flux.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.flux.dto.MatchResult;
import com.flux.dto.PoolRequest;
import com.flux.exception.ResourceNotFoundException;
import com.flux.model.SharedTrip;
import com.flux.model.SharedTripMember;
import com.flux.model.TripRequest;
import com.flux.model.User;
import com.flux.repository.SharedTripRepository;
import com.flux.repository.TripRequestRepository;
import com.flux.service.matching.CompatibilityResult;
import com.flux.service.matching.MatchingStrategy;

@Service
public class SharedTripService {

    private final SharedTripRepository sharedTripRepository;
    private final UserService userService;
    private final TripRequestRepository tripRequestRepository;
    private final MatchingStrategy matchingStrategy;

    @Autowired
    public SharedTripService(
            SharedTripRepository sharedTripRepository,
            UserService userService,
            MatchingStrategy matchingStrategy,
            TripRequestRepository tripRequestRepository) {

        this.sharedTripRepository = sharedTripRepository;
        this.userService = userService;
        this.matchingStrategy = matchingStrategy;
        this.tripRequestRepository = tripRequestRepository;
    }

    public SharedTrip joinOrCreate(PoolRequest request) {

        User user =
                userService.getById(request.getUserId());

        /*
         * PoolRequest is still our temporary API DTO.
         * Convert its travel information into a TripRequest
         * so the matching engine works with the domain model.
         */
        TripRequest tripRequest = new TripRequest();

        tripRequest.setUserId(request.getUserId());
        tripRequest.setPickup(request.getPickup().trim());
        tripRequest.setDrop(request.getDestination().trim());
        tripRequest.setDistanceKm(request.getDistanceKm());
        tripRequest.setDepartureTime(request.getDepartureTime());

        List<SharedTrip> formingTrips =
                sharedTripRepository
                        .findByStatusOrderByCreatedAtDesc(
                                SharedTrip.SharedTripStatus.FORMING
                        );

        SharedTrip bestMatch = null;
        double bestScore = -1.0;

        for (SharedTrip sharedTrip : formingTrips) {

            if (sharedTrip.getMembers().size()
                    >= SharedTrip.MAX_MEMBERS) {

                continue;
            }

            CompatibilityResult result =
                    matchingStrategy.calculateCompatibility(
                            tripRequest,
                            sharedTrip
                    );

            if (result.isCompatible()
                    && result.getScore() > bestScore) {

                bestScore = result.getScore();
                bestMatch = sharedTrip;
            }
        }

        SharedTrip sharedTrip;

        if (bestMatch != null) {

            sharedTrip = bestMatch;

        } else {

            sharedTrip = new SharedTrip();

            sharedTrip.setDestination(
                    normalize(request.getDestination())
            );

            sharedTrip.setDestinationLabel(
                    request.getDestination().trim()
            );

            sharedTrip.setDepartureTime(
                    request.getDepartureTime()
            );

            sharedTrip.setTotalFare(
                    TripRequestService.calculateFare(
                            request.getDistanceKm()
                    )
            );

            sharedTrip.setStatus(
                    SharedTrip.SharedTripStatus.FORMING
            );

            sharedTrip =
                    sharedTripRepository.save(sharedTrip);
        }

        boolean alreadyMember =
                sharedTrip.getMembers()
                        .stream()
                        .anyMatch(member ->
                                member.getUserId()
                                        .equals(user.getId())
                        );

        if (!alreadyMember) {

            SharedTripMember member =
                    new SharedTripMember(
                            sharedTrip,
                            user.getId(),
                            user.getName(),
                            request.getPickup().trim()
                    );

            sharedTrip.getMembers().add(member);
        }

        if (sharedTrip.getMembers().size()
                >= SharedTrip.MAX_MEMBERS) {

            sharedTrip.setStatus(
                    SharedTrip.SharedTripStatus.READY
            );
        }

        return sharedTripRepository.save(sharedTrip);
    }

    /*
     * Explicitly joins a passenger to a SharedTrip selected
     * from the match results.
     *
     * Unlike joinOrCreate(), this method does NOT automatically
     * choose another group or create a new group.
     */
    @Transactional
    public SharedTrip joinSharedTrip(
            Long sharedTripId,
            Long tripRequestId) {

        TripRequest tripRequest = getSearchingRequestForUpdate(tripRequestId);

        SharedTrip sharedTrip =
                getById(sharedTripId);

        User user =
                userService.getById(
                        tripRequest.getUserId()
                );

        /*
         * Only FORMING groups can accept new passengers.
         */
        if (sharedTrip.getStatus()
                != SharedTrip.SharedTripStatus.FORMING) {

            throw new IllegalArgumentException(
                    "Shared trip is not accepting new passengers"
            );
        }

        /*
         * Prevent the group from exceeding MAX_MEMBERS.
         */
        if (sharedTrip.getMembers().size()
                >= SharedTrip.MAX_MEMBERS) {

            throw new IllegalArgumentException(
                    "Shared trip is already full"
            );
        }

        /*
         * Prevent the same passenger from joining twice.
         */
        boolean alreadyMember =
                sharedTrip.getMembers()
                        .stream()
                        .anyMatch(member ->
                                member.getUserId()
                                        .equals(user.getId())
                        );

        if (alreadyMember) {

            throw new IllegalArgumentException(
                    "User is already a member of this shared trip"
            );
        }

        /*
         * Re-check compatibility on the server.
         *
         * We must not trust the frontend simply because it
         * previously displayed this group as a match.
         */
        CompatibilityResult compatibility =
                matchingStrategy.calculateCompatibility(
                        tripRequest,
                        sharedTrip
                );

        if (!compatibility.isCompatible()) {

            throw new IllegalArgumentException(
                    "Trip request is not compatible with this shared trip"
            );
        }

        SharedTripMember member =
                new SharedTripMember(
                        sharedTrip,
                        user.getId(),
                        user.getName(),
                        tripRequest.getPickup()
                );

        sharedTrip.getMembers().add(member);

        /*
         * Once the group reaches maximum capacity,
         * it becomes READY.
         */
        if (sharedTrip.getMembers().size()
                >= SharedTrip.MAX_MEMBERS) {

            sharedTrip.setStatus(
                    SharedTrip.SharedTripStatus.READY
            );
        }

        SharedTrip savedTrip = sharedTripRepository.save(sharedTrip);
        tripRequest.setStatus(TripRequest.TripRequestStatus.MATCHED);
        tripRequestRepository.save(tripRequest);
        return savedTrip;
    }

    @Transactional
    public SharedTrip ensureGroupForRequest(TripRequest request) {
        Optional<SharedTrip> existing = sharedTripRepository.findBySourceTripRequestId(request.getId());
        if (existing.isPresent()) return existing.get();

        User user = userService.getById(request.getUserId());
        SharedTrip group = new SharedTrip();
        group.setDestination(normalize(request.getDrop()));
        group.setDestinationLabel(request.getDrop().trim());
        group.setDepartureTime(request.getDepartureTime());
        group.setTotalFare(request.getFare());
        group.setStatus(SharedTrip.SharedTripStatus.FORMING);
        group.setSourceTripRequestId(request.getId());
        group.getMembers().add(new SharedTripMember(group, user.getId(), user.getName(), request.getPickup()));
        return sharedTripRepository.save(group);
    }

    @Transactional
    public SharedTrip createFromRequest(Long tripRequestId) {
        TripRequest request = getSearchingRequestForUpdate(tripRequestId);
        SharedTrip group = ensureGroupForRequest(request);
        request.setStatus(TripRequest.TripRequestStatus.MATCHED);
        tripRequestRepository.save(request);
        return group;
    }

    // Both create and explicit join lock the same request before reading its state.
    // This prevents simultaneous submissions from using one request twice.
    private TripRequest getSearchingRequestForUpdate(Long tripRequestId) {
        TripRequest request = tripRequestRepository.findByIdForUpdate(tripRequestId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Trip request not found: " + tripRequestId
                ));
        if (request.getStatus() != TripRequest.TripRequestStatus.SEARCHING) {
            throw new IllegalArgumentException(
                    "Only SEARCHING trip requests can create or join a shared trip"
            );
        }
        if (request.getDepartureTime() == null
                || !request.getDepartureTime().isAfter(LocalDateTime.now())) {
            throw new IllegalArgumentException(
                    "Departure time must be in the future"
            );
        }
        return request;
    }

    public List<SharedTrip> getFormingTrips() {

        return sharedTripRepository
                .findByStatusOrderByCreatedAtDesc(
                        SharedTrip.SharedTripStatus.FORMING
                );
    }

    public List<SharedTrip> getSharedTripsForUser(
            Long userId) {

        return sharedTripRepository
                .findSharedTripsByMemberUserId(userId);
    }

    public SharedTrip getById(Long sharedTripId) {

        return sharedTripRepository
                .findById(sharedTripId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Shared trip not found: "
                                        + sharedTripId
                        )
                );
    }

    public SharedTrip leaveSharedTrip(
            Long sharedTripId,
            Long userId) {

        SharedTrip sharedTrip =
                getById(sharedTripId);

        if (sharedTrip.getStatus()
                != SharedTrip.SharedTripStatus.FORMING) {

            throw new IllegalArgumentException(
                    "Can only leave a shared trip while it is FORMING"
            );
        }

        Optional<SharedTripMember> memberToRemove =
                sharedTrip.getMembers()
                        .stream()
                        .filter(member ->
                                member.getUserId()
                                        .equals(userId)
                        )
                        .findFirst();

        if (memberToRemove.isEmpty()) {

            throw new ResourceNotFoundException(
                    "User "
                            + userId
                            + " is not a member of shared trip "
                            + sharedTripId
            );
        }

        sharedTrip.getMembers()
                .remove(memberToRemove.get());

        return sharedTripRepository.save(sharedTrip);
    }

    public long countActiveSharedTrips() {

        return sharedTripRepository.countByStatus(
                SharedTrip.SharedTripStatus.FORMING
        )
                + sharedTripRepository.countByStatus(
                        SharedTrip.SharedTripStatus.READY
                )
                + sharedTripRepository.countByStatus(
                        SharedTrip.SharedTripStatus.BOOKED_EXTERNALLY
                );
    }

    public List<MatchResult> findMatches(
            TripRequest tripRequest) {

        List<SharedTrip> formingTrips =
                sharedTripRepository
                        .findByStatusOrderByCreatedAtDesc(
                                SharedTrip.SharedTripStatus.FORMING
                        );

        return formingTrips.stream()

                // Ignore groups that are already full
                .filter(sharedTrip ->
                        sharedTrip.getMembers().size()
                                < SharedTrip.MAX_MEMBERS
                )

                // Don't suggest a group the user already belongs to
                .filter(sharedTrip ->
                        sharedTrip.getMembers()
                                .stream()
                                .noneMatch(member ->
                                        member.getUserId()
                                                .equals(
                                                        tripRequest.getUserId()
                                                )
                                )
                )

                .map(sharedTrip -> {

                    CompatibilityResult result =
                            matchingStrategy
                                    .calculateCompatibility(
                                            tripRequest,
                                            sharedTrip
                                    );

                    if (!result.isCompatible()) {
                        return null;
                    }

                    int currentMembers =
                            sharedTrip.getMembers().size();

                    int availableSeats =
                            SharedTrip.MAX_MEMBERS
                                    - currentMembers;

                    return new MatchResult(
                            sharedTrip.getId(),
                            sharedTrip.getDestinationLabel(),
                            sharedTrip.getDepartureTime(),
                            result.getScore(),
                            result.getReasons(),
                            currentMembers,
                            availableSeats
                    );
                })

                .filter(matchResult ->
                        matchResult != null
                )

                // Best matches first
                .sorted((first, second) ->
                        Double.compare(
                                second.getCompatibilityScore(),
                                first.getCompatibilityScore()
                        )
                )

                .toList();
    }

    private String normalize(String text) {

        if (text == null) {
            return "";
        }

        return text.trim()
                .toLowerCase()
                .replaceAll("[^a-z0-9\\s]", " ")
                .trim()
                .replaceAll("\\s+", " ");
    }
}