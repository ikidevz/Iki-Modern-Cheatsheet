# Kubernetes Cheatsheet for DevOps & Platform Engineers

> A structured Kubernetes reference — cluster basics through workloads, networking, storage, security, autoscaling, Helm, and troubleshooting. Validated against **Kubernetes 1.37 ("Garhwal")**, the latest stable release as of September 2026, with 1.36 and 1.35 also under active support. Two current-events notes worth knowing up front: `ingress-nginx` was formally retired by SIG-Security in March 2026 — new clusters should evaluate an actively maintained ingress controller instead — and as of 1.37, static Pods can no longer reference Secrets/ConfigMaps (a previously-exploitable bug is now closed). `PodSecurityPolicy` remains removed (since 1.25) in favor of built-in Pod Security Admission.

## 📑 Table of Contents

1. [🧑‍💻 Complete Working Examples](#complete-working-examples)
2. [🚀 Installation & Cluster Setup](#installation-cluster-setup)
3. [📋 Core Objects & YAML Basics](#core-objects-yaml-basics)
4. [🎯 kubectl Essentials](#kubectl-essentials)
5. [🔧 Workload Resources](#workload-resources)
6. [🌐 Networking](#networking)
7. [💾 Storage](#storage)
8. [🔑 ConfigMaps & Secrets](#configmaps-secrets)
9. [📊 Namespaces, Labels & Selectors](#namespaces-labels-selectors)
10. [📈 Scaling & Autoscaling](#scaling-autoscaling)
11. [🩺 Health Checks & Probes](#health-checks-probes)
12. [🔐 RBAC & Security](#rbac-security)
13. [📦 Helm Basics](#helm-basics)
14. [🔍 Debugging & Troubleshooting](#debugging-troubleshooting)
15. [📏 Resource Management](#resource-management)
16. [🔄 Rolling Updates & Rollbacks](#rolling-updates-rollbacks)
17. [🗂️ Context & Config Management](#context-config-management)
18. [⚙️ Custom Resources & Operators](#custom-resources-operators)
19. [🧲 Pod Scheduling: Affinity, Taints & Tolerations](#pod-scheduling-affinity-taints-tolerations)
20. [📡 Observability: Metrics, Logging & Monitoring](#observability-metrics-logging-monitoring)
21. [🗃️ Kustomize & GitOps Workflows](#kustomize-gitops-workflows)
22. [💽 Backup & Disaster Recovery](#backup-disaster-recovery)
23. [⚠️ Common Gotchas](#common-gotchas)
24. [🎯 Best Practices](#best-practices)
25. [💡 Pro Tips](#pro-tips)

## ⚡ Quick Reference

**kubectl syntax cheatsheet**

| Task                   | Syntax                                                          |
| ---------------------- | --------------------------------------------------------------- |
| Apply a manifest       | `kubectl apply -f file.yaml`                                    |
| Get resources          | `kubectl get pods` / `kubectl get all -n <ns>`                  |
| Describe (full detail) | `kubectl describe pod <name>`                                   |
| View logs              | `kubectl logs <pod>` / `kubectl logs -f <pod> -c <container>`   |
| Exec into a container  | `kubectl exec -it <pod> -- /bin/sh`                             |
| Delete a resource      | `kubectl delete -f file.yaml` / `kubectl delete pod <name>`     |
| Scale a Deployment     | `kubectl scale deployment/<name> --replicas=5`                  |
| Roll out a new image   | `kubectl set image deployment/<name> <container>=<image>:<tag>` |
| Roll back              | `kubectl rollout undo deployment/<name>`                        |
| Port-forward locally   | `kubectl port-forward svc/<name> 8080:80`                       |
| Watch resources live   | `kubectl get pods -w`                                           |
| Edit live              | `kubectl edit deployment/<name>`                                |
| Dry-run + diff         | `kubectl apply -f file.yaml --dry-run=client -o yaml`           |

**Common resource shortnames**

| Full name      | Shortname | Full name                  | Shortname |
| -------------- | --------- | -------------------------- | --------- |
| `pods`         | `po`      | `configmaps`               | `cm`      |
| `deployments`  | `deploy`  | `secrets`                  | (none)    |
| `services`     | `svc`     | `persistentvolumes`        | `pv`      |
| `namespaces`   | `ns`      | `persistentvolumeclaims`   | `pvc`     |
| `replicasets`  | `rs`      | `serviceaccounts`          | `sa`      |
| `statefulsets` | `sts`     | `ingresses`                | `ing`     |
| `daemonsets`   | `ds`      | `horizontalpodautoscalers` | `hpa`     |
| `nodes`        | `no`      | `networkpolicies`          | `netpol`  |

**Probe cheat sheet**

| Probe type       | Answers                                      | On failure                                       |
| ---------------- | -------------------------------------------- | ------------------------------------------------ |
| `livenessProbe`  | "Is this container still healthy?"           | kubelet restarts the container                   |
| `readinessProbe` | "Should this pod receive traffic right now?" | Pod is pulled out of Service endpoints           |
| `startupProbe`   | "Has the app finished starting up yet?"      | Delays liveness/readiness checks until it passes |

## 🧑‍💻 Complete Working Examples

Nine end-to-end examples you can copy, rename, and apply. Each starts with a **Purpose** blurb so you can pick the right pattern before assembling pieces from the reference sections below. The first five cover the core deploy/update/config/scale/debug loop; the last four put the later sections (scheduling, observability, GitOps, backup) into practice.

### 1. Deploying a Stateless Web App (Deployment + Service + Ingress)

**Purpose:** This is the default shape for almost any web app or API on Kubernetes — multiple interchangeable replicas behind a stable internal Service, exposed externally through an Ingress. Use this as your starting template before reaching for anything more specialized like StatefulSets or Jobs.

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: web-app
          image: registry.company.com/web-app:1.4.0
          ports:
            - containerPort: 8080
          resources:
            requests: { cpu: "100m", memory: "128Mi" }
            limits: { cpu: "500m", memory: "256Mi" }
          readinessProbe:
            httpGet: { path: /healthz, port: 8080 }
            initialDelaySeconds: 5
          livenessProbe:
            httpGet: { path: /healthz, port: 8080 }
            initialDelaySeconds: 15
---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: web-app
spec:
  selector:
    app: web-app
  ports:
    - port: 80
      targetPort: 8080
---
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-app
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  rules:
    - host: app.company.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web-app
                port:
                  number: 80
  tls:
    - hosts: [app.company.com]
      secretName: web-app-tls
```

```bash
kubectl apply -f deployment.yaml -f service.yaml -f ingress.yaml
kubectl get pods -l app=web-app -w
kubectl get ingress web-app
```

### 2. Zero-Downtime Rolling Update and Rollback

**Purpose:** Use this whenever you're shipping a new image version and need traffic to keep flowing throughout — Kubernetes replaces old Pods with new ones gradually, respecting readiness probes so a broken new version never receives traffic. It also shows how to abort and revert instantly if the new version turns out to be bad.

```bash
# Ship v1.5.0 — Kubernetes creates new Pods and terminates old ones gradually
kubectl set image deployment/web-app web-app=registry.company.com/web-app:1.5.0 --record

# Watch the rollout happen in real time
kubectl rollout status deployment/web-app

# If something looks wrong mid-rollout, pause it immediately
kubectl rollout pause deployment/web-app

# Confirm it's actually broken (crash loops, failed readiness, etc.)
kubectl get pods -l app=web-app
kubectl logs -l app=web-app --tail=50

# Roll back to the previous working version
kubectl rollout undo deployment/web-app

# Or roll back to a specific earlier revision
kubectl rollout history deployment/web-app
kubectl rollout undo deployment/web-app --to-revision=3
```

```yaml
# Control rollout speed/safety declaratively in the Deployment spec
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1 # at most 1 pod down at a time
      maxSurge: 1 # at most 1 extra pod above `replicas` during rollout
  minReadySeconds: 10 # a new pod must stay Ready this long before counting as "up"
```

### 3. Externalized Configuration with ConfigMaps and Secrets

**Purpose:** Use this pattern whenever an app needs environment-specific settings (URLs, feature flags) or sensitive values (API keys, DB passwords) without baking them into the container image. It shows both env-var injection and mounting values as files, plus updating config without rebuilding the image.

```bash
# Non-sensitive config
kubectl create configmap web-app-config \
  --from-literal=LOG_LEVEL=info \
  --from-literal=FEATURE_NEW_CHECKOUT=true

# Sensitive values — kubectl base64-encodes these automatically
kubectl create secret generic web-app-secrets \
  --from-literal=DB_PASSWORD='s3cr3t' \
  --from-literal=API_KEY='abc123'
```

```yaml
# Reference both in the Pod spec
spec:
  containers:
    - name: web-app
      image: registry.company.com/web-app:1.5.0
      envFrom:
        - configMapRef: { name: web-app-config }
      env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef: { name: web-app-secrets, key: DB_PASSWORD }
      volumeMounts:
        - name: config-volume
          mountPath: /etc/config
  volumes:
    - name: config-volume
      configMap: { name: web-app-config }
```

```bash
# Update config without touching the image — then roll the pods to pick it up
kubectl create configmap web-app-config --from-literal=LOG_LEVEL=debug \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl rollout restart deployment/web-app
```

### 4. Autoscaling Under Variable Load (HPA + Requests/Limits)

**Purpose:** Use this whenever traffic or workload volume varies enough that a fixed replica count either wastes money at quiet times or falls over during spikes. Autoscaling depends entirely on accurate `resources.requests` — the HPA computes utilization as a percentage of the _requested_ CPU, not the node's total capacity.

```yaml
# deployment.yaml (relevant excerpt) — requests are mandatory for CPU-based HPA
resources:
  requests: { cpu: "250m", memory: "256Mi" }
  limits: { cpu: "1", memory: "512Mi" }
```

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300 # don't scale down within 5 min of a spike
```

```bash
kubectl apply -f hpa.yaml
kubectl get hpa web-app -w
kubectl top pods -l app=web-app   # requires the metrics-server add-on
```

### 5. Debugging a Crashing Pod

**Purpose:** This is the troubleshooting sequence to run the moment `kubectl get pods` shows `CrashLoopBackOff`, `ImagePullBackOff`, or `Pending` instead of `Running`. It walks through the standard diagnostic ladder — status, events, logs (including the previous crashed instance), then a live shell if the container is actually up — so you stop guessing and start narrowing down the real cause.

```bash
# 1. What state is it actually in, and how many times has it restarted?
kubectl get pods -l app=web-app

# 2. Events at the bottom of `describe` usually name the real problem —
#    image pull failures, failed scheduling, OOMKilled, failed probes, etc.
kubectl describe pod <pod-name>

# 3. Logs from the CURRENT container...
kubectl logs <pod-name>
# ...and from the PREVIOUS instance, if it already restarted — this is
# usually the one that actually has the crash's stack trace
kubectl logs <pod-name> --previous

# 4. Multi-container pod? Specify which one
kubectl logs <pod-name> -c <container-name>

# 5. Still running but misbehaving (not crashing outright)? Get a shell
kubectl exec -it <pod-name> -- /bin/sh

# 6. Suspect a resource or scheduling issue? Check the node it landed on
kubectl get pod <pod-name> -o jsonpath='{.spec.nodeName}'
kubectl describe node <node-name>

# 7. Pending and never scheduled at all? Check for insufficient resources,
#    taints and missing tolerations, or unsatisfiable node affinity
kubectl get events --sort-by=.lastTimestamp -n <namespace> | tail -20
```

### 6. High-Availability Scheduling with Anti-Affinity and a PodDisruptionBudget

**Purpose:** Use this whenever a workload actually needs to survive a single node failure or a routine node drain during upgrades — by default, Kubernetes is happy to schedule all your replicas onto the same node, which means one node going down takes the whole app with it. This combines `podAntiAffinity` (spread replicas across nodes) with a `PodDisruptionBudget` (limit how many can be taken down at once during _voluntary_ disruptions like drains), which are two different problems that people often assume one setting solves.

```yaml
# deployment.yaml (relevant excerpt)
spec:
  replicas: 4
  template:
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchLabels: { app: web-app }
              topologyKey: kubernetes.io/hostname # never co-locate two replicas on one node
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone # also spread evenly across AZs
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels: { app: web-app }
---
# pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: web-app-pdb }
spec:
  minAvailable: 3 # at most 1 of the 4 replicas may be voluntarily disrupted at a time
  selector:
    matchLabels: { app: web-app }
```

```bash
kubectl apply -f deployment.yaml -f pdb.yaml

# Confirm replicas actually landed on different nodes
kubectl get pods -l app=web-app -o wide

# Simulate an upgrade — this now respects the PDB and won't evict past minAvailable
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
kubectl get pdb web-app-pdb -w
```

### 7. Bootstrapping Cluster Observability (metrics-server + Prometheus + ServiceMonitor)

**Purpose:** Use this the first time a cluster needs real metrics instead of guesswork — it's also a prerequisite most people hit unexpectedly: CPU-based HPA (Example 4) silently does nothing without `metrics-server`, and Prometheus needs both the operator installed _and_ a `ServiceMonitor` per app before it will scrape anything. This walks through all three pieces end to end, from zero to a working `/metrics` scrape target.

```bash
# 1. metrics-server — required for `kubectl top` and CPU/memory HPA
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl top nodes    # should return real numbers within a minute or two

# 2. Prometheus Operator + stack (Prometheus, Alertmanager, Grafana, kube-state-metrics)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace
```

```yaml
# 3. Expose your app's /metrics port through a Service, then tell Prometheus
#    to scrape it via a ServiceMonitor — Prometheus does NOT auto-discover
#    every Service, only ones matched by a ServiceMonitor's selector.
apiVersion: v1
kind: Service
metadata:
  name: web-app-metrics
  labels: { app: web-app }
spec:
  selector: { app: web-app }
  ports:
    - name: metrics
      port: 9090
      targetPort: 9090
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: web-app
  namespace: monitoring
  labels:
    release: monitoring # must match the label the Helm chart's Prometheus watches for
spec:
  selector:
    matchLabels: { app: web-app }
  endpoints:
    - port: metrics
      interval: 30s
```

```bash
kubectl apply -f web-app-metrics-service.yaml -f web-app-servicemonitor.yaml

# Confirm Prometheus picked up the new target
kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090
# open http://localhost:9090/targets and look for web-app

# Grafana ships in the same chart, with default dashboards already wired up
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
```

### 8. GitOps Continuous Deployment with Kustomize and Argo CD

**Purpose:** Use this when manual `kubectl apply` from laptops becomes a liability — multiple people deploying by hand, no audit trail of what changed when, and configuration drifting from what's actually in Git. This wires a Kustomize base + per-environment overlays (Section: Kustomize & GitOps) into Argo CD so every merge to `main` is automatically, visibly, and safely reconciled onto the cluster, with drift corrected automatically if anyone changes something out-of-band.

```yaml
# repo structure (in a separate "manifests" git repo, not your app's source repo)
# base/
#   kustomization.yaml
#   deployment.yaml
#   service.yaml
# overlays/staging/kustomization.yaml
# overlays/production/kustomization.yaml
```

```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: production
resources: [../../base]
images:
  - name: registry.company.com/web-app
    newTag: "1.5.0"
replicas:
  - name: web-app
    count: 6
```

```yaml
# argocd-application.yaml — install once; Argo CD then owns all future syncs
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: web-app-production
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/company/web-app-manifests.git
    targetRevision: main
    path: overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true # remove resources deleted from Git
      selfHeal: true # revert manual out-of-band changes automatically
    syncOptions: ["CreateNamespace=true"]
```

```bash
kubectl apply -f argocd-application.yaml -n argocd

# Ship a new version from here on by editing Git, not by running kubectl
# (e.g. bump `newTag` in overlays/production/kustomization.yaml, commit, push)
argocd app get web-app-production
argocd app sync web-app-production      # or just wait — automated sync picks it up
argocd app history web-app-production   # every past sync, for rollback reference
```

### 9. Backup-and-Restore Drill with Velero

**Purpose:** Use this to actually rehearse disaster recovery instead of just trusting that scheduled backups exist — the goal is proving a full namespace (app objects _and_ its PersistentVolume data) can come back after being deleted. Run this quarterly against a real backup, not just when reading about it for the first time during an actual incident.

```bash
# One-time setup: Velero plus a plugin for your cloud's object storage/snapshots
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.10.0 \
  --bucket my-velero-backups \
  --backup-location-config region=us-east-1 \
  --snapshot-location-config region=us-east-1

# Take a real backup of a namespace, including PV snapshots
velero backup create production-drill --include-namespaces production --wait
velero backup describe production-drill --details

# --- The actual drill: destroy the namespace on purpose ---
kubectl delete namespace production

# Restore everything from the backup into the same namespace
velero restore create --from-backup production-drill --wait
velero restore describe production-drill --details

# Verify the app and its data actually came back correctly
kubectl get all -n production
kubectl get pvc -n production
kubectl exec -it <db-pod> -n production -- psql -c "SELECT count(*) FROM orders;"
```

```bash
# Once the manual drill works, automate it going forward
velero schedule create nightly-production --schedule="0 2 * * *" --include-namespaces production
velero schedule get
```

## 🚀 Installation & Cluster Setup

```bash
# kubectl — the CLI you'll use for everything below
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/

kubectl version --client
kubectl cluster-info

# Local dev clusters
kind create cluster --name dev              # Kubernetes-in-Docker, fast, disposable
minikube start --driver=docker              # single-node VM/container cluster
k3d cluster create dev                      # lightweight k3s in Docker

# Bootstrap a real multi-node cluster (control plane node)
kubeadm init --pod-network-cidr=10.244.0.0/16
mkdir -p $HOME/.kube
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# Join a worker node (token printed by `kubeadm init`)
kubeadm join <control-plane-ip>:6443 --token <token> --discovery-token-ca-cert-hash <hash>
```

```bash
# Cluster-wide sanity checks
kubectl get nodes -o wide
kubectl get componentstatuses     # deprecated but still informative on some distros
kubectl get pods -A               # every pod, every namespace — spot anything crashing early
```

## 📋 Core Objects & YAML Basics

```yaml
# The four fields every Kubernetes manifest needs
apiVersion: apps/v1 # which API group/version defines this kind
kind: Deployment # the resource type
metadata:
  name: web-app # unique name within the namespace
  namespace: default
  labels:
    app: web-app # arbitrary key/value used for selection and grouping
spec: # desired state — the bulk of every manifest
  # ... kind-specific fields ...
```

```bash
# Apply is declarative and idempotent — safe to re-run
kubectl apply -f manifest.yaml
kubectl apply -f ./manifests/           # apply every file in a directory
kubectl apply -k ./overlays/production/ # apply a Kustomize overlay

# create is imperative — fails if the resource already exists
kubectl create -f manifest.yaml

# See what apply WOULD change, without changing anything
kubectl diff -f manifest.yaml

# Generate a manifest skeleton instead of hand-writing YAML from scratch
kubectl create deployment web-app --image=nginx --dry-run=client -o yaml > deployment.yaml
```

## 🎯 kubectl Essentials

```bash
kubectl get pods                              # pods in the current namespace
kubectl get pods -A                           # pods in every namespace
kubectl get pods -o wide                      # + node, IP, and more columns
kubectl get pods -o yaml                      # full object as YAML
kubectl get pods --show-labels

kubectl describe pod <name>                   # full detail + recent Events (start here when debugging)
kubectl logs <pod>                            # current container's logs
kubectl logs -f <pod>                         # follow/stream logs live
kubectl logs <pod> --previous                 # logs from the last crashed instance

kubectl exec -it <pod> -- /bin/sh             # interactive shell
kubectl exec <pod> -- env                     # run one command, no shell

kubectl cp <pod>:/path/in/container ./local/path   # copy a file out of a container
kubectl port-forward pod/<name> 8080:80       # tunnel a local port to a pod/service

kubectl delete pod <name>                     # delete one resource
kubectl delete -f manifest.yaml               # delete everything defined in a file
kubectl delete pods --field-selector=status.phase=Failed  # bulk-delete by field
```

## 🔧 Workload Resources

```yaml
# Deployment — stateless, interchangeable replicas (covered above in the examples)

# StatefulSet — stable network identity + storage per replica, ordered rollout
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres # headless Service required for stable DNS per pod
  replicas: 3
  selector:
    matchLabels: { app: postgres }
  template:
    metadata:
      labels: { app: postgres }
    spec:
      containers:
        - name: postgres
          image: postgres:16
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates: # each replica gets its OWN PVC (postgres-0, postgres-1, ...)
    - metadata: { name: data }
      spec:
        accessModes: ["ReadWriteOnce"]
        resources: { requests: { storage: 10Gi } }
---
# DaemonSet — exactly one pod per (matching) node — log shippers, node monitors, CNI agents
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
spec:
  selector:
    matchLabels: { app: node-exporter }
  template:
    metadata: { labels: { app: node-exporter } }
    spec:
      containers:
        - name: node-exporter
          image: prom/node-exporter:v1.8.0
---
# Job — run to completion, then stop (batch processing, migrations)
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: registry.company.com/migrator:2.1.0
---
# CronJob — a Job on a schedule
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-report
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: report
              image: registry.company.com/reporter:1.0.0
```

```bash
kubectl get jobs
kubectl get cronjobs
kubectl create job manual-run --from=cronjob/nightly-report   # trigger a CronJob on demand
```

## 🌐 Networking

```yaml
# ClusterIP (default) — internal-only, stable virtual IP for a set of pods
apiVersion: v1
kind: Service
metadata: { name: web-app }
spec:
  type: ClusterIP
  selector: { app: web-app }
  ports: [{ port: 80, targetPort: 8080 }]
---
# NodePort — exposes the service on a static port on every node (dev/testing mostly)
spec:
  type: NodePort
  ports: [{ port: 80, targetPort: 8080, nodePort: 30080 }]
---
# LoadBalancer — provisions an external cloud load balancer (managed clusters)
spec:
  type: LoadBalancer
  ports: [{ port: 80, targetPort: 8080 }]
---
# Headless Service (clusterIP: None) — used by StatefulSets for stable per-pod DNS
spec:
  clusterIP: None
  selector: { app: postgres }
  ports: [{ port: 5432 }]
```

```yaml
# NetworkPolicy — default-deny, then explicitly allow what's needed
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: deny-all }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-web-to-db }
spec:
  podSelector:
    matchLabels: { app: postgres }
  ingress:
    - from:
        - podSelector: { matchLabels: { app: web-app } }
      ports: [{ port: 5432 }]
```

```bash
kubectl get svc,ingress,networkpolicy
kubectl get endpoints web-app     # confirm the Service actually has healthy pods behind it
```

## 💾 Storage

```yaml
# PersistentVolumeClaim — a request for storage, satisfied by a PV (static or dynamic)
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: app-data }
spec:
  accessModes: ["ReadWriteOnce"]
  storageClassName: fast-ssd
  resources: { requests: { storage: 20Gi } }
---
# StorageClass — defines HOW dynamic provisioning creates a PV on demand
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: { name: fast-ssd }
provisioner: ebs.csi.aws.com
parameters: { type: gp3 }
volumeBindingMode: WaitForFirstConsumer # don't provision until a pod actually needs it
```

```yaml
# Mounting it into a Pod
spec:
  containers:
    - name: app
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim: { claimName: app-data }
```

```bash
kubectl get pv,pvc
kubectl get storageclass
kubectl describe pvc app-data     # check Bound/Pending status and events if storage isn't attaching
```

## 🔑 ConfigMaps & Secrets

```bash
# From literals, files, or entire directories
kubectl create configmap app-config --from-literal=KEY=value
kubectl create configmap app-config --from-file=app.properties
kubectl create secret generic app-secrets --from-literal=PASSWORD=hunter2
kubectl create secret tls web-tls --cert=tls.crt --key=tls.key
kubectl create secret docker-registry regcred \
  --docker-server=registry.company.com --docker-username=svc --docker-password=***
```

```bash
# Read values back out (Secrets are base64-encoded, NOT encrypted, at this layer)
kubectl get secret app-secrets -o jsonpath='{.data.PASSWORD}' | base64 -d
```

- Prefer mounting Secrets as files over env vars for anything sensitive — env vars are more likely to leak into logs, crash dumps, or child-process environments.
- Enable encryption-at-rest for Secrets in the API server (`EncryptionConfiguration`) — by default they're only base64-encoded in etcd, not encrypted.
- For real secrets management, use an external secrets operator (e.g. External Secrets Operator, Vault) that syncs from a proper secrets store instead of `kubectl create secret` in CI.

## 📊 Namespaces, Labels & Selectors

```bash
kubectl create namespace staging
kubectl get pods -n staging
kubectl config set-context --current --namespace=staging   # stop typing -n every time

kubectl get pods -l app=web-app                # equality-based selector
kubectl get pods -l 'environment in (prod,staging)'   # set-based selector
kubectl label pod <name> tier=frontend         # add/update a label
kubectl label pod <name> tier-                 # remove a label
```

```yaml
# ResourceQuota — cap total resource consumption per namespace
apiVersion: v1
kind: ResourceQuota
metadata: { name: staging-quota, namespace: staging }
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    pods: "50"
```

## 📈 Scaling & Autoscaling

```bash
kubectl scale deployment/web-app --replicas=5           # manual scaling
kubectl autoscale deployment/web-app --min=3 --max=20 --cpu-percent=70   # imperative HPA
```

```yaml
# VerticalPodAutoscaler — adjusts requests/limits automatically instead of replica count
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata: { name: web-app-vpa }
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  updatePolicy:
    updateMode: "Auto" # or "Off" to only get recommendations without applying them
```

- **HPA** changes replica _count_ based on live metrics (CPU, memory, or custom/external metrics via the metrics API).
- **VPA** changes each pod's resource _requests/limits_ — don't run both on the same workload for the same metric, they'll fight each other.
- **Cluster Autoscaler** adds/removes _nodes_ when pods can't be scheduled due to insufficient cluster capacity — it works one layer below HPA/VPA.

## 🩺 Health Checks & Probes

```yaml
spec:
  containers:
    - name: app
      startupProbe: # gives slow-starting apps room before liveness kicks in
        httpGet: { path: /healthz, port: 8080 }
        failureThreshold: 30
        periodSeconds: 10
      readinessProbe:
        httpGet: { path: /ready, port: 8080 }
        initialDelaySeconds: 5
        periodSeconds: 10
      livenessProbe:
        httpGet: { path: /healthz, port: 8080 }
        initialDelaySeconds: 15
        periodSeconds: 20
        failureThreshold: 3
```

```yaml
# TCP and exec probes for apps without an HTTP health endpoint
livenessProbe:
  tcpSocket: { port: 5432 }
readinessProbe:
  exec:
    command: ["pg_isready", "-U", "postgres"]
```

## 🔐 RBAC & Security

```yaml
# ServiceAccount — an identity for pods/processes, distinct from human user identities
apiVersion: v1
kind: ServiceAccount
metadata: { name: app-sa, namespace: staging }
---
# Role — permissions scoped to ONE namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { name: pod-reader, namespace: staging }
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
# RoleBinding — grants the Role to a subject (user, group, or ServiceAccount)
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: read-pods, namespace: staging }
subjects:
  - kind: ServiceAccount
    name: app-sa
    namespace: staging
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
---
# ClusterRole / ClusterRoleBinding — same idea, but cluster-wide (or reusable across namespaces)
```

```bash
kubectl auth can-i delete pods --as=system:serviceaccount:staging:app-sa -n staging
kubectl create rolebinding temp-admin --clusterrole=admin --user=jane@company.com -n staging
```

```yaml
# Pod Security Admission — namespace-level labels replace the removed PodSecurityPolicy
apiVersion: v1
kind: Namespace
metadata:
  name: staging
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/warn: restricted
```

```yaml
# securityContext — lock down what a container/pod is allowed to do
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 2000
  containers:
    - name: app
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities: { drop: ["ALL"] }
```

## 📦 Helm Basics

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

helm install my-release bitnami/postgresql --namespace data --create-namespace
helm install my-release ./my-chart --values values-production.yaml

helm list -A
helm status my-release
helm get values my-release           # what values are actually in effect

helm upgrade my-release ./my-chart --values values-production.yaml
helm rollback my-release 2           # back to revision 2
helm uninstall my-release

helm template ./my-chart --values values-production.yaml   # render YAML without installing — great for review
helm lint ./my-chart                 # catch chart mistakes before install
```

```yaml
# A chart's Chart.yaml + minimal templates/deployment.yaml structure
# my-chart/
#   Chart.yaml
#   values.yaml
#   templates/
#     deployment.yaml
#     service.yaml

# templates/deployment.yaml (excerpt)
spec:
  replicas: { { .Values.replicaCount } }
  template:
    spec:
      containers:
        - name: { { .Chart.Name } }
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
```

## 🔍 Debugging & Troubleshooting

```bash
kubectl get events --sort-by=.lastTimestamp -A          # cluster-wide, most recent last
kubectl top nodes                                        # requires metrics-server
kubectl top pods -A --sort-by=cpu

# A pod that never even gets scheduled
kubectl describe pod <name> | grep -A5 Events
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints

# Ephemeral debug container — attach a shell to a running pod that has none itself
kubectl debug -it <pod-name> --image=busybox --target=<container-name>

# Spin up a disposable pod to test connectivity from inside the cluster
kubectl run tmp-shell --rm -it --image=busybox -- /bin/sh
# from inside: wget -qO- http://web-app.default.svc.cluster.local

# DNS troubleshooting
kubectl run -it --rm dnsutils --image=tutum/dnsutils -- nslookup web-app.default.svc.cluster.local

# API server / etcd health on a self-managed cluster
kubectl get --raw='/healthz?verbose'
```

## 📏 Resource Management

```yaml
resources:
  requests: # guaranteed minimum — used for scheduling decisions
    cpu: "250m" # 0.25 of a vCPU
    memory: "256Mi"
  limits: # hard ceiling — CPU is throttled, memory over-limit gets OOMKilled
    cpu: "1"
    memory: "512Mi"
```

**QoS classes** (assigned automatically from requests/limits, affects eviction order under node pressure)

| Class        | When it applies                                                  |
| ------------ | ---------------------------------------------------------------- |
| `Guaranteed` | requests == limits for every container, for both CPU and memory  |
| `Burstable`  | At least one container has requests set, but not equal to limits |
| `BestEffort` | No requests or limits set at all — evicted first under pressure  |

```bash
kubectl describe node <name> | grep -A5 "Allocated resources"   # see requests vs. capacity per node
```

## 🔄 Rolling Updates & Rollbacks

```bash
kubectl rollout status deployment/web-app
kubectl rollout history deployment/web-app
kubectl rollout history deployment/web-app --revision=3
kubectl rollout undo deployment/web-app
kubectl rollout undo deployment/web-app --to-revision=3
kubectl rollout restart deployment/web-app    # re-create pods without changing the image (e.g. after ConfigMap update)
kubectl rollout pause deployment/web-app
kubectl rollout resume deployment/web-app
```

## 🗂️ Context & Config Management

```bash
kubectl config get-contexts                    # every cluster/user/namespace combo you have
kubectl config current-context
kubectl config use-context prod-cluster        # switch clusters entirely
kubectl config set-context --current --namespace=staging   # switch namespace within a context

kubectl config view                             # see the merged kubeconfig (secrets redacted)
export KUBECONFIG=~/.kube/config:~/.kube/prod-config   # merge multiple kubeconfig files
```

```bash
# kubectx / kubens (popular third-party helpers) make the above one command
kubectx prod-cluster
kubens staging
```

## ⚙️ Custom Resources & Operators

```yaml
# CustomResourceDefinition — teach the API server a new kind
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata: { name: backups.batch.company.com }
spec:
  group: batch.company.com
  scope: Namespaced
  names: { plural: backups, singular: backup, kind: Backup }
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                schedule: { type: string }
```

```yaml
# A custom resource instance, once the CRD above is installed
apiVersion: batch.company.com/v1
kind: Backup
metadata: { name: nightly-db-backup }
spec:
  schedule: "0 3 * * *"
```

- A **Controller/Operator** watches custom resources and reconciles real cluster state to match `spec` — the CRD alone just defines the schema; you still need something (often written with kubebuilder or Operator SDK) actually acting on it.
- `kubectl get crds` lists every custom type installed in the cluster — useful for discovering what a Helm chart or platform team has already added.

## 🧲 Pod Scheduling: Affinity, Taints & Tolerations

```yaml
# nodeSelector — simplest form: only schedule onto nodes with this exact label
spec:
  nodeSelector:
    disktype: ssd
```

```yaml
# nodeAffinity — richer rules, with "required" (hard) and "preferred" (soft) variants
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: kubernetes.io/arch
                operator: In
                values: ["amd64"]
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 80
          preference:
            matchExpressions:
              - key: disktype
                operator: In
                values: ["ssd"]
```

```yaml
# podAffinity / podAntiAffinity — schedule relative to OTHER pods, not just node labels
spec:
  affinity:
    podAntiAffinity: # spread replicas across nodes for high availability
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchLabels: { app: web-app }
          topologyKey: kubernetes.io/hostname
```

```yaml
# Taints repel pods unless they explicitly tolerate them — used for dedicated node pools
# (applied to the NODE, not the pod):
#   kubectl taint nodes node-1 gpu=true:NoSchedule
spec:
  tolerations:
    - key: "gpu"
      operator: "Equal"
      value: "true"
      effect: "NoSchedule"
```

```yaml
# PriorityClass — influences scheduling and preemption order under resource pressure
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: { name: high-priority }
value: 1000000
globalDefault: false
---
spec:
  priorityClassName: high-priority
```

```yaml
# PodDisruptionBudget — protects availability during voluntary disruptions (drains, upgrades)
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: web-app-pdb }
spec:
  minAvailable: 2 # or: maxUnavailable: 1
  selector:
    matchLabels: { app: web-app }
```

```bash
kubectl taint nodes node-1 gpu=true:NoSchedule    # apply a taint
kubectl taint nodes node-1 gpu:NoSchedule-         # remove it (trailing dash)
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints
kubectl drain node-1 --ignore-daemonsets --delete-emptydir-data   # respects PDBs automatically
```

## 📡 Observability: Metrics, Logging & Monitoring

```bash
# metrics-server powers `kubectl top` and CPU/memory-based HPA — most managed
# clusters ship it already; install manually if `kubectl top` returns nothing
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

kubectl top nodes
kubectl top pods -A --sort-by=memory
```

```bash
# Prometheus + kube-state-metrics is the standard cluster-metrics stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
```

```yaml
# ServiceMonitor — tells the Prometheus Operator to scrape a Service's /metrics endpoint
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata: { name: web-app, namespace: monitoring }
spec:
  selector:
    matchLabels: { app: web-app }
  endpoints:
    - port: metrics
      interval: 30s
```

```bash
# Centralized logging: ship container stdout/stderr off the node instead of
# relying on `kubectl logs` (which disappears once a pod is gone)
helm install loki grafana/loki-stack -n monitoring   # Loki + Promtail
# or: Fluent Bit / Fluentd -> Elasticsearch, another common pairing

# Aggregate logs across every pod matching a label, tailing live
kubectl logs -l app=web-app --all-containers --prefix -f --max-log-requests=10
```

- `kubectl logs`/`kubectl top` only ever show what's true **right now** (or since the current container started) — anything you need after a pod is deleted must already be flowing to a real logging/metrics backend.
- Alert on **symptoms** (error rate, latency, saturation) more than on individual pod restarts — a self-healing restart that meets SLOs usually shouldn't page anyone.

## 🗃️ Kustomize & GitOps Workflows

```
# Typical Kustomize layout: one base, environment-specific overlays on top
base/
├── kustomization.yaml
├── deployment.yaml
└── service.yaml
overlays/
├── staging/
│   ├── kustomization.yaml
│   └── replica-patch.yaml
└── production/
    ├── kustomization.yaml
    └── replica-patch.yaml
```

```yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
```

```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: production
resources:
  - ../../base
patches:
  - path: replica-patch.yaml
images:
  - name: registry.company.com/web-app
    newTag: "1.5.0"
```

```bash
kubectl apply -k overlays/production/
kustomize build overlays/production/     # preview the fully-rendered YAML first
```

```yaml
# GitOps: instead of anyone running `kubectl apply`, a controller continuously
# reconciles the cluster to match what's committed in Git
# Argo CD Application example:
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: web-app, namespace: argocd }
spec:
  source:
    repoURL: https://github.com/company/web-app-manifests.git
    targetRevision: main
    path: overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated: { prune: true, selfHeal: true }
```

**GitOps tool comparison**

| Tool    | Model                                                                   |
| ------- | ----------------------------------------------------------------------- |
| Argo CD | Pull-based, UI-forward, per-app sync status and diffing                 |
| Flux    | Pull-based, more composable/CLI-first, tight Kustomize/Helm integration |

## 💽 Backup & Disaster Recovery

```bash
# etcd holds ALL cluster state — back it up on any self-managed control plane
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-snapshot-$(date +%F).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

```bash
# Velero — the standard tool for backing up/restoring Kubernetes objects AND
# their associated persistent volume data (via cloud snapshots or restic/kopia)
velero install --provider aws --plugins velero/velero-plugin-for-aws:v1.10.0 \
  --bucket my-velero-backups --backup-location-config region=us-east-1

velero backup create daily-backup --include-namespaces production
velero backup create prod-before-migration --include-namespaces production --wait

velero schedule create nightly --schedule="0 2 * * *" --include-namespaces production

velero restore create --from-backup prod-before-migration
velero backup describe prod-before-migration --details
```

- Managed clusters (EKS/GKE/AKS) handle etcd/control-plane backups for you — Velero-style backups are still your responsibility for **application-level** objects and PV data.
- Always test a restore into a _separate_ namespace or cluster periodically — an untested backup is a hope, not a plan.

## ⚠️ Common Gotchas

- **`kubectl delete pod` on a Deployment-managed pod just gets it recreated** — the ReplicaSet controller notices the missing replica and spins up a new one immediately. To actually remove capacity, scale the Deployment down instead.
- **Readiness probes failing silently pull a pod out of the Service** without killing it — `kubectl get pods` shows `Running`, but the pod gets zero traffic. Always check `kubectl get endpoints` when "it's running but nothing reaches it."
- **CPU limits throttle; memory limits kill** — a container that hits its CPU limit just runs slower (throttled), but one that exceeds its memory limit is OOMKilled immediately. Size memory limits with real headroom.
- **`latest` image tags break rollbacks** — if every revision references `:latest`, `kubectl rollout undo` re-pulls the _same_ tag, not the old image. Always deploy with immutable, versioned tags.
- **Secrets are base64, not encrypted, by default** — anyone with `get secret` RBAC access (or etcd access) can trivially decode them unless you've enabled encryption-at-rest.
- **`ingress-nginx` is no longer actively maintained** (retired by SIG-Security, March 2026) — new clusters should evaluate alternatives (e.g. a cloud-native gateway, Traefik, or another CNCF-maintained ingress controller) rather than defaulting to it out of habit.
- **HPA needs `resources.requests` set to compute utilization** — without it, CPU-based autoscaling simply won't have anything to divide by and the HPA sits at "unknown."
- **A `Job`'s pods aren't cleaned up automatically** unless you set `ttlSecondsAfterFinished` — completed Jobs and their pods otherwise pile up indefinitely.
- **Namespace deletion can hang** on resources with finalizers that never resolve (common with some operators/CRDs) — check `kubectl get namespace <ns> -o yaml` for a stuck `status.conditions` if a `Terminating` namespace won't go away.
- **A `PodDisruptionBudget` set too strictly can block node drains entirely** — if `minAvailable` equals your replica count, `kubectl drain` will hang waiting for a budget that can never be satisfied.
- **`nodeAffinity`'s `IgnoredDuringExecution` suffix means exactly what it says** — if a node's labels change after a pod is already running there, the pod is NOT evicted; the rule only affects future scheduling decisions.
- **A Velero (or any) backup that's never been restored isn't verified** — test restores into a scratch namespace regularly, not just when a real incident forces the first attempt.

## 🎯 Best Practices

```yaml
# Always set both requests AND limits — never ship a pod with neither
resources:
  requests: { cpu: "100m", memory: "128Mi" }
  limits: { cpu: "500m", memory: "256Mi" }

# Pin exact, immutable image tags (or digests) — never `:latest` in a real environment
image: registry.company.com/web-app:1.5.0
# image: registry.company.com/web-app@sha256:abcd1234...   # even stronger

# Always define readiness AND liveness probes for anything behind a Service
readinessProbe: { httpGet: { path: /ready, port: 8080 } }
livenessProbe: { httpGet: { path: /healthz, port: 8080 } }
```

- Use namespaces to separate environments/teams, and back them with `ResourceQuota` + `NetworkPolicy` so one team's noisy workload or misconfigured pod can't starve or reach another's.
- Run `kubectl diff -f` (or `helm diff`) before every apply in a shared environment — know exactly what's about to change.
- Default every NetworkPolicy-enabled namespace to deny-all, then explicitly allow the traffic each workload actually needs.
- Keep manifests in version control and deploy through CI/CD (GitOps: Argo CD, Flux) rather than ad-hoc `kubectl apply` from a laptop against production.
- Set `PodDisruptionBudget`s on anything that must stay available during voluntary disruptions (node drains, cluster upgrades).

## 💡 Pro Tips

1. **`kubectl describe` before `kubectl logs`** — the Events section at the bottom usually names the actual problem (image pull failure, failed scheduling, OOMKilled) before you even open a log.
2. **Set `kubectl config set-context --current --namespace=<ns>`** once per project instead of typing `-n` on every command.
3. **Use `--dry-run=client -o yaml`** to generate a manifest skeleton from an imperative command instead of hand-writing YAML from scratch.
4. **`kubectl get events --sort-by=.lastTimestamp`** cluster-wide is often faster than hunting through individual `describe` calls when several things look wrong at once.
5. **Always set `ttlSecondsAfterFinished` on Jobs** so completed pods don't accumulate forever.
6. **Use ephemeral debug containers (`kubectl debug`)** for distroless/minimal images that don't ship a shell of their own.
7. **Alias `kubectl` to `k`** and install `kubectx`/`kubens` — the two most-repeated actions (switch cluster, switch namespace) deserve to be one word.
8. **Prefer `kubectl apply -k`** (Kustomize) over maintaining near-duplicate YAML per environment — overlay just the differences.
9. **Watch rollouts, don't just trigger them** — `kubectl rollout status` blocks until success or failure instead of leaving you guessing.
10. **Check `kubectl get endpoints`**, not just pod status, whenever "the pods are running but nothing can reach the service."
11. **Set resource requests based on real `kubectl top pod` data**, not guesses — under-requesting causes scheduling and eviction surprises later.
12. **Render Helm charts locally (`helm template`)** before installing/upgrading, so you review the actual YAML that will hit the API server.
13. **Label everything consistently** (`app`, `env`, `team`, `version`) from day one — retrofitting labels across hundreds of existing resources is painful.
14. **Test NetworkPolicies with a disposable pod** (`kubectl run tmp-shell --rm -it`) rather than assuming the policy does what the YAML implies.
15. **Read the release notes for every minor version bump** — Kubernetes deprecates and removes APIs on a predictable but real cadence; `kubectl convert` can help migrate manifests off a soon-to-be-removed API version.
16. **Run `kustomize build` (or `helm template`) before every apply** so you review the fully-rendered YAML, not just the overlay/patch you edited.
17. **Let a GitOps controller (Argo CD/Flux) own `kubectl apply` in shared environments** — it gives you drift detection and an audit trail that ad-hoc CLI applies never will.
18. **Schedule automated Velero backups, don't rely on remembering to run them manually** — `velero schedule create` takes one line and prevents the worst kind of "we forgot" incident.
