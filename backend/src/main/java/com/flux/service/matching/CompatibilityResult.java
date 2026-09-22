package com.flux.service.matching;

import java.util.ArrayList;
import java.util.List;

/**
 * Represents the result of comparing a user's trip request
 * with an existing shared trip.
 */
public class CompatibilityResult {

    private final double score;
    private final boolean compatible;
    private final List<String> reasons;

    public CompatibilityResult(
            double score,
            boolean compatible,
            List<String> reasons) {

        this.score = score;
        this.compatible = compatible;
        this.reasons = reasons == null
                ? new ArrayList<>()
                : new ArrayList<>(reasons);
    }

    public double getScore() {
        return score;
    }

    public boolean isCompatible() {
        return compatible;
    }

    public List<String> getReasons() {
        return new ArrayList<>(reasons);
    }
}