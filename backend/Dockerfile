FROM gradle:8.7-jdk17 AS build
WORKDIR /workspace
COPY build.gradle settings.gradle ./
COPY src ./src
RUN gradle bootJar --no-daemon

FROM eclipse-temurin:17-jre-jammy
WORKDIR /app
COPY --from=build /workspace/build/libs/flux-backend-1.0.0.jar /app/app.jar
USER 10001
ENV JAVA_TOOL_OPTIONS="-Xmx256m -XX:MaxMetaspaceSize=160m -XX:+ExitOnOutOfMemoryError -Duser.timezone=Asia/Kolkata"
EXPOSE 10000
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
