package com.flux.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class GroupMessageRequest {
    @NotNull private Long userId;
    @NotBlank @Size(max=500) private String message;
    public Long getUserId(){ return userId; }
    public void setUserId(Long v){ userId=v; }
    public String getMessage(){ return message; }
    public void setMessage(String v){ message=v; }
}