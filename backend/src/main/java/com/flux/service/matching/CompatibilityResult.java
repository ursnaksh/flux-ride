package com.flux.service.matching;

import java.util.ArrayList;
import java.util.List;

public class CompatibilityResult {

    private final double score;
    private final boolean compatible;
    private final List<String> reasons;
    private final double routeOverlapScore;
    private final Double estimatedDetourKm;

    public CompatibilityResult(double score, boolean compatible, List<String> reasons) {
        this(score, compatible, reasons, 0.0, null);
    }

    public CompatibilityResult(
            double score,
            boolean compatible,
            List<String> reasons,
            double routeOverlapScore,
            Double estimatedDetourKm) {

        this.score = score;
        this.compatible = compatible;
        this.reasons = reasons == null ? new ArrayList<>() : new ArrayList<>(reasons);
        this.routeOverlapScore = routeOverlapScore;
        this.estimatedDetourKm = estimatedDetourKm;
    }

    public double getScore() { return score; }
    public boolean isCompatible() { return compatible; }
    public List<String> getReasons() { return new ArrayList<>(reasons); }
    public double getRouteOverlapScore() { return routeOverlapScore; }
    public Double getEstimatedDetourKm() { return estimatedDetourKm; }
}
