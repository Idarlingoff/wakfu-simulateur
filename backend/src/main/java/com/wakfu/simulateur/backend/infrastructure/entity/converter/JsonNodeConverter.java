package com.wakfu.simulateur.backend.infrastructure.entity.converter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class JsonNodeConverter implements AttributeConverter<JsonNode, String> {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override public String convertToDatabaseColumn(JsonNode attribute) {
        try { return attribute == null ? null : MAPPER.writeValueAsString(attribute); }
        catch (Exception e) { throw new IllegalArgumentException("Cannot write JSON", e); }
    }

    @Override public JsonNode convertToEntityAttribute(String dbData) {
        try { return dbData == null ? null : MAPPER.readTree(dbData); }
        catch (Exception e) { throw new IllegalArgumentException("Cannot read JSON", e); }
    }
}
