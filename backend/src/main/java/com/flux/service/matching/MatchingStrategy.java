package com.flux.service.matching;

import com.flux.model.SharedTrip;
import com.flux.model.TripRequest;

/**
 * Defines the contract for FLUX RIDE matching algorithms.
 *
 * Different matching strategies can implement this interface
 * without changing the rest of the application.
 */
public interface MatchingStrategy {

    /**
     * Evaluates how compatible a user's trip request
     * is with an existing shared trip.
     *
     * @param tripRequest user's travel request
     * @param sharedTrip existing shared trip
     * @return detailed compatibility result
     */
    CompatibilityResult calculateCompatibility(
            TripRequest tripRequest,
            SharedTrip sharedTrip
    );
}