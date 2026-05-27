# Stage 1: Build
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Run
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from:build /app/target/patchflow-api-1.0.0.jar app.jar
EXPOSE 5001
ENTRYPOINT ["java", "-jar", "app.jar"]
