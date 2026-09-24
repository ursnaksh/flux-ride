package com.flux.model;

import java.time.LocalDateTime;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String phone;

    @Column(name = "phone_verified", nullable = false)
    private Boolean phoneVerified = Boolean.FALSE;

    @Column(name = "phone_verified_at")
    private LocalDateTime phoneVerifiedAt;

    @Column(name = "student_email", unique = true)
    private String studentEmail;

    @Column(name = "student_verified", nullable = false)
    private Boolean studentVerified = Boolean.FALSE;

    @Column(name = "student_verified_at")
    private LocalDateTime studentVerifiedAt;

    public User() {
    }

    public User(String name, String phone) {
        this.name = name;
        this.phone = phone;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public boolean isPhoneVerified() {
        return Boolean.TRUE.equals(phoneVerified);
    }

    public void setPhoneVerified(Boolean phoneVerified) {
        this.phoneVerified = Boolean.TRUE.equals(phoneVerified);
    }

    public LocalDateTime getPhoneVerifiedAt() {
        return phoneVerifiedAt;
    }

    public void setPhoneVerifiedAt(LocalDateTime phoneVerifiedAt) {
        this.phoneVerifiedAt = phoneVerifiedAt;
    }

    public String getStudentEmail() {
        return studentEmail;
    }

    public void setStudentEmail(String studentEmail) {
        this.studentEmail = studentEmail;
    }

    public boolean isStudentVerified() {
        return Boolean.TRUE.equals(studentVerified);
    }

    public void setStudentVerified(Boolean studentVerified) {
        this.studentVerified = Boolean.TRUE.equals(studentVerified);
    }

    public LocalDateTime getStudentVerifiedAt() {
        return studentVerifiedAt;
    }

    public void setStudentVerifiedAt(LocalDateTime studentVerifiedAt) {
        this.studentVerifiedAt = studentVerifiedAt;
    }

    /** Two-letter initials used for the colored avatar circles in the UI. */
    public String getInitials() {
        if (name == null || name.isBlank()) return "?";
        String[] parts = name.trim().split("\\s+");
        if (parts.length == 1) {
            return parts[0].substring(0, Math.min(2, parts[0].length())).toUpperCase();
        }
        return ("" + parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
}
