# SQLx 0.6 relies on type inference behavior that changed in Rust 1.100.
FROM rust:1.99.0-bookworm AS builder
WORKDIR /usr/src/enrich
COPY . .
ENV RUST_MIN_STACK=16777216
RUN cargo install --locked --path .

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /usr/src/enrich/Rocket.toml .
COPY --from=builder /usr/local/cargo/bin/enrich /usr/local/bin/enrich
CMD ["enrich"]
