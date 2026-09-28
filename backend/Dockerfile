# ---------- Build ----------
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /workspace

# Copy backend and frontend
COPY backend ./backend
COPY frontend ./frontend

WORKDIR /workspace/backend

RUN mvn clean package -Pfrontend -DskipTests -B


# ---------- Runtime ----------
FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=build \
    /workspace/backend/target/hitbloq-spring-proxy-0.0.1-SNAPSHOT.jar \
    app.jar

EXPOSE 3001

ENTRYPOINT ["java", "-jar", "app.jar"]