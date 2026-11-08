package main

import (
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"sync/atomic"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	serviceName = getenv("SERVICE_NAME", "payments-svc")
	version     = getenv("VERSION", "dev")
	failRateBits atomic.Uint64

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
	setFailRate(parseFailRate(getenv("FAIL_RATE", "0")))

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/healthz", instrument("/healthz", health))
	mux.HandleFunc("/readyz", instrument("/readyz", ready))
	mux.HandleFunc("/chaos", chaos)
	mux.HandleFunc("/", instrument("/", root))

	server := &http.Server{
		Addr:              ":8080",
		Handler:           cors(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("%s listening on %s version=%s fail_rate=%.2f", serviceName, server.Addr, version, getFailRate())
	log.Fatal(server.ListenAndServe())
}

func root(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	if rand.Float64() < getFailRate() {
		http.Error(w, "injected failure", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"service": serviceName,
		"version": version,
	})
}

// chaos lets the dashboard read (GET) or change (POST ?rate=0.5) the injected failure rate at runtime.
func chaos(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
	case http.MethodPost:
		raw := r.URL.Query().Get("rate")
		if raw == "" {
			http.Error(w, "missing rate query parameter", http.StatusBadRequest)
			return
		}
		setFailRate(parseFailRate(raw))
		log.Printf("fail_rate set to %.2f via /chaos", getFailRate())
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"service":  serviceName,
		"failRate": getFailRate(),
	})
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func getFailRate() float64 {
	return math.Float64frombits(failRateBits.Load())
}

func setFailRate(rate float64) {
	failRateBits.Store(math.Float64bits(rate))
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

