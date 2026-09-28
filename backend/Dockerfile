# syntax=docker/dockerfile:1

FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /workspace

# --------------------------------------------------
# 1. Copy dependency descriptors first
# --------------------------------------------------

COPY backend/pom.xml ./backend/pom.xml

COPY frontend/package.json ./frontend/package.json
COPY frontend/package-lock.json ./frontend/package-lock.json


# --------------------------------------------------
# 2. Preload Maven dependencies
# --------------------------------------------------

WORKDIR /workspace/backend

RUN --mount=type=cache,target=/root/.m2 \
    mvn dependency:go-offline -Pfrontend -B


# --------------------------------------------------
# 3. Copy actual source code
# --------------------------------------------------

WORKDIR /workspace

COPY backend/src ./backend/src
COPY frontend ./frontend


# --------------------------------------------------
# 4. Build
# --------------------------------------------------

WORKDIR /workspace/backend

RUN --mount=type=cache,target=/root/.m2 \
    --mount=type=cache,target=/root/.npm \
    mvn package -Pfrontend -DskipTests -B


# --------------------------------------------------
# Runtime image
# --------------------------------------------------

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build \
    /workspace/backend/target/hitbloq-spring-proxy-0.0.1-SNAPSHOT.jar \
    app.jar

EXPOSE 3001

ENTRYPOINT ["java", "-jar", "app.jar"]