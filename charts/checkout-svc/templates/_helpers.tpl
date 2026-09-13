{{- define "checkout-svc.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "checkout-svc.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- include "checkout-svc.name" . -}}
{{- end -}}
{{- end -}}

{{- define "checkout-svc.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "checkout-svc.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: driftguard
{{- end -}}

{{- define "checkout-svc.selectorLabels" -}}
app.kubernetes.io/name: {{ include "checkout-svc.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

