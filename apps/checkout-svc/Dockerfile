FROM golang:1.26.1 AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/checkout-svc .

FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=build /out/checkout-svc /checkout-svc
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/checkout-svc"]
