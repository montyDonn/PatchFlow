package com.patchflow.config;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.UUID;

/**
 * Automatically converts String ↔ java.util.UUID for all JPA entities.
 * Applied globally (@Converter(autoApply = false)) — must be explicitly used
 * on @Column(columnDefinition = "uuid") String fields via @Convert.
 */
@Converter
public class UUIDStringConverter implements AttributeConverter<String, UUID> {

    @Override
    public UUID convertToDatabaseColumn(String attribute) {
        if (attribute == null || attribute.isBlank()) return null;
        try {
            return UUID.fromString(attribute);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    @Override
    public String convertToEntityAttribute(UUID dbData) {
        return dbData != null ? dbData.toString() : null;
    }
}
