package com.flux;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;

import java.time.LocalDateTime;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.ResponseEntity;

import com.fasterxml.jackson.databind.JsonNode;
import com.flux.model.SharedTrip;
import com.flux.model.SharedTripMember;
import com.flux.model.TripRequest;
import com.flux.model.User;
import com.flux.repository.SharedTripRepository;
import com.flux.repository.TripRequestRepository;
import com.flux.repository.UserRepository;
import com.flux.service.TripRequestService;

/** Real HTTP -> controller -> service -> JPA tests against an isolated H2 database. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:h2:mem:flux_lifecycle;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class TripRequestLifecycleTest {
    @Autowired private TestRestTemplate http;
    @Autowired private SharedTripRepository groups;
    @Autowired private UserRepository users;
    @Autowired private TripRequestService requestService;
    @SpyBean private TripRequestRepository requests;

    private User passenger;
    private LocalDateTime departure;

    @BeforeEach
    void setUp() {
        reset(requests);
        groups.deleteAll();
        requests.deleteAll();
        users.deleteAll();
        passenger = users.save(new User("Swapnil", "9000000001"));
        departure = LocalDateTime.now().plusDays(2).withNano(0);
    }

    @Test
    void createMatchChooseJoinAndReadBack() {
        long requestId = createRequest();
        SharedTrip selected = group("airport", departure.plusMinutes(6), "VIT Road", 1);
        group("airport", departure, "VIT Main Road", 1);

        JsonNode matches = http.getForObject("/api/pools/matches/" + requestId, JsonNode.class).path("data");
        assertThat(matches.size()).isEqualTo(2);
        assertThat(matches.get(0).path("compatibilityScore").asDouble()).isEqualTo(1.0);
        assertThat(matches.get(1).path("compatibilityScore").asDouble()).isEqualTo(0.88);
        assertThat(matches.get(1).path("reasons").size()).isEqualTo(3);
        assertThat(requests.findById(requestId).orElseThrow().getDepartureTime()).isEqualTo(departure);
        assertThat(requests.findById(requestId).orElseThrow().getStatus())
                .isEqualTo(TripRequest.TripRequestStatus.SEARCHING);

        assertThat(join(selected.getId(), requestId).getStatusCode().value()).isEqualTo(200);
        assertThat(groups.findById(selected.getId()).orElseThrow().getMembers()).hasSize(2);
        assertThat(requests.findById(requestId).orElseThrow().getStatus())
                .isEqualTo(TripRequest.TripRequestStatus.MATCHED);
        assertThat(requestService.getOpenRequests()).isEmpty();
        JsonNode history = http.getForObject("/api/rides/user/" + passenger.getId(), JsonNode.class);
        assertThat(history.path("data").get(0).path("status").asText()).isEqualTo("MATCHED");
        JsonNode remaining = http.getForObject("/api/pools/matches/" + requestId, JsonNode.class).path("data");
        for (JsonNode match : remaining) {
            assertThat(match.path("sharedTripId").asLong()).isNotEqualTo(selected.getId());
        }
        assertThat(join(selected.getId(), requestId).getStatusCode().value()).isEqualTo(400);
        assertThat(groups.findById(selected.getId()).orElseThrow().getMembers()).hasSize(2);
    }

    @Test
    void destinationAndTimeRejectionsPreserveSearching() {
        long id = createRequest();
        SharedTrip wrongDestination = group("station", departure, "VIT Main Road", 1);
        SharedTrip wrongTime = group("airport", departure.plusMinutes(60), "VIT Main Road", 1);
        for (SharedTrip trip : new SharedTrip[] {wrongDestination, wrongTime}) {
            assertThat(join(trip.getId(), id).getStatusCode().value()).isEqualTo(400);
            assertThat(groups.findById(trip.getId()).orElseThrow().getMembers()).hasSize(1);
        }
        assertSearching(id);
    }

    @Test
    void duplicatePassengerWithAnotherRequestIsRejected() {
        long first = createRequest();
        SharedTrip trip = group("airport", departure, "VIT Main Road", 1);
        assertThat(join(trip.getId(), first).getStatusCode().value()).isEqualTo(200);
        long second = createRequest();
        assertThat(join(trip.getId(), second).getStatusCode().value()).isEqualTo(400);
        assertSearching(second);
        assertThat(groups.findById(trip.getId()).orElseThrow().getMembers()).hasSize(2);
        assertThat(http.getForObject("/api/pools/matches/" + second, JsonNode.class).path("data").size())
                .isZero();
    }

    @ParameterizedTest
    @EnumSource(value = TripRequest.TripRequestStatus.class, names = {"MATCHED", "CANCELLED", "COMPLETED"})
    void nonSearchingRequestCannotJoin(TripRequest.TripRequestStatus status) {
        long id = createRequest();
        TripRequest request = requests.findById(id).orElseThrow();
        request.setStatus(status);
        requests.save(request);
        SharedTrip trip = group("airport", departure, "VIT Main Road", 1);
        assertThat(join(trip.getId(), id).getStatusCode().value()).isEqualTo(400);
        assertThat(groups.findById(trip.getId()).orElseThrow().getMembers()).hasSize(1);
        assertThat(requests.findById(id).orElseThrow().getStatus()).isEqualTo(status);
    }

    @Test
    void fourthMemberMakesGroupReadyAndFifthCannotJoin() {
        long id = createRequest();
        SharedTrip trip = group("airport", departure, "VIT Main Road", 3);
        assertThat(join(trip.getId(), id).getStatusCode().value()).isEqualTo(200);
        SharedTrip saved = groups.findById(trip.getId()).orElseThrow();
        assertThat(saved.getMembers()).hasSize(4);
        assertThat(saved.getStatus()).isEqualTo(SharedTrip.SharedTripStatus.READY);
        passenger = users.save(new User("Tanishka", "9000000002"));
        long fifth = createRequest();
        assertThat(join(trip.getId(), fifth).getStatusCode().value()).isEqualTo(400);
        assertSearching(fifth);
        assertThat(groups.findById(trip.getId()).orElseThrow().getMembers()).hasSize(4);
    }

    @Test
    void fullFormingGroupIsAlsoRejected() {
        long id = createRequest();
        SharedTrip trip = group("airport", departure, "VIT Main Road", 4);
        assertThat(join(trip.getId(), id).getStatusCode().value()).isEqualTo(400);
        assertSearching(id);
        assertThat(groups.findById(trip.getId()).orElseThrow().getMembers()).hasSize(4);
    }

    @Test
    void missingResourcesDoNotChangeRequest() {
        long id = createRequest();
        assertThat(join(Long.MAX_VALUE, id).getStatusCode().value()).isEqualTo(404);
        assertSearching(id);
        SharedTrip trip = group("airport", departure, "VIT Main Road", 1);
        assertThat(join(trip.getId(), Long.MAX_VALUE).getStatusCode().value()).isEqualTo(404);
        assertThat(groups.findById(trip.getId()).orElseThrow().getMembers()).hasSize(1);
    }

    @Test
    void failedStatusSaveRollsBackMembershipAndReadyTransition() {
        long id = createRequest();
        SharedTrip trip = group("airport", departure, "VIT Main Road", 3);
        doThrow(new IllegalStateException("Simulated status persistence failure"))
                .when(requests).save(any(TripRequest.class));
        try {
            assertThat(join(trip.getId(), id).getStatusCode().value()).isEqualTo(500);
        } finally {
            reset(requests);
        }
        assertSearching(id);
        SharedTrip saved = groups.findById(trip.getId()).orElseThrow();
        assertThat(saved.getMembers()).hasSize(3);
        assertThat(saved.getStatus()).isEqualTo(SharedTrip.SharedTripStatus.FORMING);
    }

    @Test
    void missingDepartureIsRejectedByApi() {
        ResponseEntity<JsonNode> response = http.postForEntity("/api/rides", Map.of(
                "userId", passenger.getId(), "pickup", "VIT Main Road",
                "drop", "Airport", "distanceKm", 12.0), JsonNode.class);
        assertThat(response.getStatusCode().value()).isEqualTo(400);
        assertThat(requests.count()).isZero();
    }

    private long createRequest() {
        ResponseEntity<JsonNode> response = http.postForEntity("/api/rides", Map.of(
                "userId", passenger.getId(), "pickup", " VIT Main Road ",
                "drop", " Airport ", "distanceKm", 12.0,
                "departureTime", departure.toString()), JsonNode.class);
        assertThat(response.getStatusCode().value()).isEqualTo(201);
        JsonNode data = response.getBody().path("data");
        assertThat(data.path("status").asText()).isEqualTo("SEARCHING");
        assertThat(data.path("pickup").asText()).isEqualTo("VIT Main Road");
        assertThat(data.path("fare").asDouble()).isEqualTo(159.0);
        return data.path("id").asLong();
    }

    private ResponseEntity<JsonNode> join(long groupId, long requestId) {
        return http.postForEntity("/api/pools/" + groupId + "/join/" + requestId, null, JsonNode.class);
    }

    private void assertSearching(long id) {
        assertThat(requests.findById(id).orElseThrow().getStatus()).isEqualTo(TripRequest.TripRequestStatus.SEARCHING);
    }

    private SharedTrip group(String destination, LocalDateTime time, String pickup, int count) {
        SharedTrip group = new SharedTrip();
        group.setDestination(destination);
        group.setDestinationLabel(destination);
        group.setDepartureTime(time);
        group.setTotalFare(159.0);
        group.setStatus(SharedTrip.SharedTripStatus.FORMING);
        for (int i = 0; i < count; i++) {
            User member = users.save(new User(new String[] {"Nagesh", "Tanishka", "Swapnil", "Nagesh"}[i], "seed-" + java.util.UUID.randomUUID()));
            group.getMembers().add(new SharedTripMember(group, member.getId(), member.getName(), pickup));
        }
        return groups.save(group);
    }
}
