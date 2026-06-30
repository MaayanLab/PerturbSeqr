FROM rust AS builder
WORKDIR /usr/src/enrich
COPY . .
ENV RUST_MIN_STACK=16777216
RUN cargo install --path .

FROM debian:bookworm-slim
COPY --from=builder /usr/src/enrich/Rocket.toml .
COPY --from=builder /usr/local/cargo/bin/enrich /usr/local/bin/enrich
CMD ["enrich"]