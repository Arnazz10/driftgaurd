package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	serviceName = getenv("SERVICE_NAME", "checkout-svc")
	version     = getenv("VERSION", "dev")
	failRate    = parseFailRate(getenv("FAIL_RATE", "0"))

	requests = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "driftguard_http_requests_total",
		Help: "Total HTTP requests by service, route, method, and status code.",
	}, []string{"service", "route", "method", "status"})

	latency = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "driftguard_http_request_duration_seconds",
		Help:    "HTTP request latency by service, route, and method.",
		Buckets: prometheus.DefBuckets,
	}, []string{"service", "route", "method"})
)

func main() {
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/healthz", instrument("/healthz", health))
	mux.HandleFunc("/readyz", instrument("/readyz", ready))
	mux.HandleFunc("/", instrument("/", root))

	server := &http.Server{
		Addr:              ":8080",
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("%s listening on %s version=%s fail_rate=%.2f", serviceName, server.Addr, version, failRate)
	log.Fatal(server.ListenAndServe())
}

func root(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	if rand.Float64() < failRate {
		http.Error(w, "injected failure", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"service": serviceName,
		"version": version,
	})
}

func health(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok\n"))
}

func ready(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ready\n"))
}

func instrument(route string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next(rec, r)
		status := strconv.Itoa(rec.status)
		requests.WithLabelValues(serviceName, route, r.Method, status).Inc()
		latency.WithLabelValues(serviceName, route, r.Method).Observe(time.Since(start).Seconds())
	}
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func getenv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func parseFailRate(raw string) float64 {
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil || value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}
	return value
}

