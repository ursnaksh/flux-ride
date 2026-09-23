package com.flux.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.flux.model.GroupMessage;

public interface GroupMessageRepository extends JpaRepository<GroupMessage, Long> {
    List<GroupMessage> findBySharedTripIdOrderByCreatedAtAsc(Long sharedTripId);
}