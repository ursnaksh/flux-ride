package com.flux.model;

import java.time.LocalDateTime;
import jakarta.persistence.*;

@Entity
@Table(name = "group_messages")
public class GroupMessage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable=false) private Long sharedTripId;
    @Column(nullable=false) private Long userId;
    @Column(nullable=false) private String userName;
    @Column(nullable=false, length=500) private String message;
    @Column(nullable=false) private LocalDateTime createdAt;

    public GroupMessage() {}
    @PrePersist protected void onCreate(){ createdAt = LocalDateTime.now(); }
    public Long getId(){ return id; }
    public Long getSharedTripId(){ return sharedTripId; }
    public void setSharedTripId(Long v){ sharedTripId=v; }
    public Long getUserId(){ return userId; }
    public void setUserId(Long v){ userId=v; }
    public String getUserName(){ return userName; }
    public void setUserName(String v){ userName=v; }
    public String getMessage(){ return message; }
    public void setMessage(String v){ message=v; }
    public LocalDateTime getCreatedAt(){ return createdAt; }
}