{{- define "payments-svc.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "payments-svc.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- include "payments-svc.name" . -}}
{{- end -}}
{{- end -}}

{{- define "payments-svc.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "payments-svc.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: driftguard
{{- end -}}

{{- define "payments-svc.selectorLabels" -}}
app.kubernetes.io/name: {{ include "payments-svc.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

