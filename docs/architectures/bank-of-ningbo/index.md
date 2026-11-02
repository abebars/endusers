---
title: "Cloud Native AI Resource Management and Inference Service Governance with Kubernetes, HAMi and Higress at Bank of Ningbo"
sidebar_label: "Bank of Ningbo"
architecture:
  organization: Bank of Ningbo
  summary: Bank of Ningbo, a regional city commercial bank, runs financial LLM inference across general-purpose GPUs and domestic accelerators on Kubernetes, with HAMi managing heterogeneous compute and Higress routing requests across models and clusters.
  industries:
    - Financial Services
  tags:
    - ai
    - llm inference
    - ai gateway
    - gpu scheduling
    - heterogeneous accelerators
    - multi-cluster
    - model routing
    - private cloud
    - platform engineering
  projects:
    - Kubernetes
    - HAMi
    - Higress
  sourceUrl: https://github.com/cncf/tab/issues/141
  published: 2026-11-02
  updated: 2026-11-02
---

import CNCFProjectCard from '@site/src/components/CNCFProjectCard';

> Submitted by Bank of Ningbo and DaoCloud to the CNCF End User Technical Advisory Board via [cncf/tab#141](https://github.com/cncf/tab/issues/141). Documentation is distributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Relevant CNCF projects

<CNCFProjectCard name="Kubernetes" href="https://www.cncf.io/projects/kubernetes/" logo="/img/cncf-projects/kubernetes-kubernetes-icon-color.svg" description="Container orchestration, resource scheduling and cluster self-healing across the bank's financial private cloud, and the standardized foundation for resource management and inference-service governance across chip types and models." />

<CNCFProjectCard name="HAMi" href="https://www.cncf.io/projects/hami/" logo="/img/cncf-projects/hami-hami-icon-color.svg" description="Brings general-purpose GPUs and domestic accelerators into the Kubernetes resource model with a consistent resource view, request mechanism and scheduling process, selecting whole-device or fine-grained allocation per device." />

<CNCFProjectCard name="Higress" href="https://www.cncf.io/projects/higress/" logo="/img/cncf-projects/higress-higress-icon-color.svg" description="Unified entry point and traffic governance for inference services: request-attribute-based model routing, weighted backend selection, health checks and removal of unhealthy backends, and basic observability." />

## Organization

Bank of Ningbo is a regional city commercial bank with a strong focus on local inclusive finance, retail banking, corporate banking, and intelligent risk management. It continues to advance its digital and AI transformation. In recent years, the bank has progressively deployed financial large language models (LLMs) in its private environment, carried out scenario-specific fine-tuning, and introduced intelligent inference services. Its model portfolio now includes large general-purpose models, long-context business models, lightweight question-answering models, and finance-specific models. The bank also uses heterogeneous compute resources, including general-purpose GPUs and domestically developed accelerators, as AI applications increasingly enter routine production use.

Compared with large banks, city commercial banks generally prioritize lightweight implementation, incremental iteration, and practical results in AI initiatives. Rather than pursuing very large clusters, they focus on making better use of existing compute capacity, standardizing model services, and tailoring them to business scenarios. This project represents a phased effort by the bank to standardize and consolidate its AI infrastructure.

## Architecture overview and goals

### Context and problem space

As AI moved from pilots into everyday banking services, Bank of Ningbo found itself operating multiple model types across general-purpose GPUs and domestic NPUs. Hardware-specific deployment stacks, whole-card allocation, and independently exposed model services created resource islands. Some clusters were overloaded while others sat underused, and teams had to manually match each workload to a model, accelerator, and endpoint.

The initiative moves away from a capital-intensive, large-scale expansion model. Instead, it uses open source cloud native technologies to unlock the value of existing compute resources and model assets, enabling lightweight, standardized, and efficient delivery of financial AI scenarios.

### Goals

- Govern heterogeneous compute through one Kubernetes-based resource model rather than one deployment stack per chip type.
- Give business applications a single inference entry point that hides chip types and cluster distribution.
- Route each request to a model sized for the work, so routine question answering does not consume high-end compute.
- Share inference capacity across GPU and domestic accelerator clusters, with basic overflow and failover between them.
- Keep the investment manageable and the rollout incremental, as a reference for other small and mid-sized banks.

### Architecture

Using Kubernetes as the foundation, the bank has established a layered architecture centered on resource management plus inference-service governance. From bottom to top, it comprises four layers: heterogeneous compute infrastructure and resource pools, the financial Kubernetes foundation, the LLM service platform, and intelligent business applications.

The design follows three principles: separation of concerns, allowing the compute, platform, and service layers to evolve independently; unified management of different resource pools through multiple Kubernetes clusters to reduce repetitive configuration; and incremental extension, introducing components such as Kueue and Spiderpool as specific scenarios require.

![Layered architecture with four tiers. At the top, an intelligent business application layer with AI customer service, AI risk control, operations audit, text analytics and AI marketing. Below it, the LLM service platform, split into an inference service governance layer provided by Higress (unified access, model routing, traffic weighting, health checks, failure isolation, runtime observability, security controls) and a model management foundation layer (model lifecycle management, model tagging and grouping, access control, model marketplace). Below that, the financial-grade Kubernetes foundation with multi-cluster management, holding HAMi for heterogeneous compute management and scheduling, Kueue for queue management and quotas marked as planned, and Spiderpool for network management, providing unified management of GPU and domestic accelerator resource pools. At the bottom, the heterogeneous compute infrastructure with a GPU compute resource pool of general-purpose GPU servers and a domestic compute resource pool of domestic accelerator servers, over high-speed networking and distributed storage deployed in a financial private cloud. A legend marks solid borders as current-phase scope and dashed borders as future-phase scope.](./images/architecture.png)

### Heterogeneous compute infrastructure and resource pools

General-purpose GPUs, domestically developed NPUs, and other accelerators, together with supporting high-speed networks and distributed storage, are deployed in the bank's financial private cloud to form the heterogeneous compute infrastructure. Resources are divided by chip type into a GPU compute pool and a domestic accelerator pool, each managed by an independent Kubernetes cluster. This prevents devices from different vendors from interfering with one another in terms of drivers, runtimes, and operational processes. The layer does not alter chip-specific drivers or runtime environments; instead, it reduces the complexity of managing and configuring diverse resources at the resource-management layer.

### Financial Kubernetes foundation and compute resource management

The financial Kubernetes foundation manages the GPU and domestic accelerator pools through a multi-cluster approach, providing a consistent container execution environment for model services and platform components. On this foundation, components are introduced or planned for resource scheduling, queue and quota management, and networking:

- **HAMi (heterogeneous compute management and scheduling):** Registers accelerators with adapted device plugins and runtime environments as resources that Kubernetes can recognize and request, creating a relatively consistent resource view, request mechanism, and scheduling process. Whole-device allocation or fine-grained partitioning is selected according to hardware capabilities, reducing the complexity of managing and configuring different hardware types.
- **Kueue (queue and quota management):** A planned component for a later phase. When compute sharing across departments and batch-training workloads expand, it will provide queue priorities and quota controls.
- **Spiderpool (network management):** Provides IP address allocation and network orchestration for containers in the clusters as a supporting foundation component.

Together with Kubernetes-native scheduling, these components support standardized resource request templates, scheduling constraints, and deployment workflows, reducing repetitive configuration when the same model is deployed across different clusters.

### LLM service platform and inference-service governance

The LLM service platform consists of a model management foundation layer and an inference-service governance layer. The foundation layer handles end-to-end model lifecycle management, model tagging, classification and grouping, access control, and a model marketplace, providing a unified view of model assets and a request entry point for different business units. Higress provides the inference-service governance layer, including a unified entry point, input-attribute-based model routing, traffic-weight allocation, health checks and removal of unhealthy backends, operational observability, and security controls. Its responsibilities remain distinct from those of the bank's existing API gateway and security platforms.

#### Tiered multi-model routing based on input attributes

To support mixed deployments of large general-purpose models, long-context business models, lightweight question-answering models, and finance-specific models, Higress routes requests to appropriate model services using preconfigured policies. Routing inputs include business origin, API type and path, caller identity, business tags, context length, request priority, SLA tier, the requested model, and backend service status. More complex workloads are routed to larger models, while routine question answering and lightweight scenarios are routed to smaller models to avoid unnecessary consumption of high-end compute resources.

#### Logical pooling of inference services across chip types

HAMi allocates resources at deployment time, while Higress schedules traffic at runtime. Once models of the same specification are deployed separately on the GPU and domestic accelerator clusters, Higress provides a relatively unified service entry point and distributes new requests among the backends based on preset weights, business rules, and health status. This enables a degree of shared use of cross-chip inference services and basic failover capabilities.

Requests are distributed across inference clusters through preconfigured traffic weights, business-tier policies, service health checks, and threshold-based triggers. When a primary cluster becomes unhealthy or reaches a preset load threshold, eligible new requests are redirected to a standby cluster, providing basic traffic overflow and failover.

### Intelligent business application layer

Internal AI applications, including intelligent risk management, intelligent customer service, operational auditing, text parsing, and intelligent marketing, invoke model services through the unified entry point. Business systems do not need to be aware of the underlying chip types or cluster distribution. Combined with model tags and access controls, this enables business units to request model capabilities as needed and gradually reuse models, compute resources, and service capabilities.

## Can you expand on why you are using those projects/services?

### CNCF projects

- **Kubernetes:** Fits the bank's financial private-cloud architecture. It provides container orchestration, resource scheduling, and cluster self-healing, supports AI service deployment across multiple chip types and models, and establishes a standardized foundation for resource management and inference-service governance.
- **HAMi:** Integrates natively with Kubernetes without requiring a redesign of the existing technology stack. Its main value is bringing previously adapted heterogeneous accelerators into the Kubernetes resource management system, providing a relatively consistent resource view, resource request mechanism, and scheduling process while reducing the complexity of managing and configuring different hardware types separately. Drivers, runtimes, model images, and operator adaptations for different chips remain the responsibility of the corresponding hardware platforms. Whole-device or fine-grained resource allocation is selected according to each device's capabilities.
- **Higress:** Compared with a general-purpose API gateway, Higress provides inference-oriented capabilities including a unified entry point, request-attribute-based routing, backend selection based on traffic weights and health status, removal of unhealthy backends, and basic observability. It is a traffic-governance component at the inference-service layer. It neither replaces underlying compute scheduling nor performs inference-engine performance optimization.
- **Spiderpool:** Provides IP address allocation and network orchestration for containers in the clusters as a supporting foundation component.

### Kubernetes ecosystem projects

- **Kueue (Kubernetes SIG subproject):** The bank currently manages training and inference resources in separate pools, with relatively limited resource contention among tenants and no large-scale requirement for queueing batch jobs. Kueue is being retained as a technology option for future use when compute sharing across departments and batch-training workloads expand; it is not part of the implemented outcomes covered by this architecture.

## What has worked well?

### Preliminary outcomes

The bank has made initial progress in the following areas of unified resource management and inference-service governance.

Resource management:

- The scope of unified management of heterogeneous resources has expanded gradually, with adapted accelerators onboarded through a consistent process.
- Duplicate resource configuration and service onboarding work has been reduced.
- The applicability of whole-device and fine-grained resource allocation has been validated in selected scenarios.

Inference-service governance:

- Initial tiered multi-model routing capabilities have been established, based on input attributes and preconfigured policies.
- Cross-cluster traffic switching mechanisms, including health-check-based backend removal and threshold-triggered diversion, have been validated in selected scenarios.
- A technical foundation has been established for future improvements in model invocation costs and service reliability.

### Reusable lessons

- **Clear layering and well-defined component responsibilities.** The two-layer split, HAMi for underlying resource management and Higress for upper-layer inference-service governance, matches the current implementation scope, with clearly defined responsibilities that prevent the components' capabilities from being conflated.
- **Designed for mixed heterogeneous environments at small and mid-sized banks.** Unlike architectures built around a single compute type and standardized models, this solution addresses the coexistence of multiple chip types and mixed deployments of models with different specifications, a common situation among city commercial banks. Starting with resource management and unified service entry points, it provides a lightweight approach with manageable investment requirements.
- **Pragmatic reuse of open source components.** HAMi focuses on resource management and scheduling, while Higress focuses on inference-service traffic governance. Management of both components is incorporated into the bank's existing security management framework. The solution is based on open source components configured and integrated for the bank's deployment and operational needs, without overstating what those components can do.
- **A lightweight path focused on optimizing existing resources.** Rather than relying solely on hardware expansion, the bank uses resource management and service governance to improve utilization of its existing compute resources and model assets, offering small and mid-sized banks a practical implementation path with incremental rollout options.

## What's next for your architecture? What are you looking to do next?

- **Expand HAMi coverage:** Progressively onboard additional accelerator models once their device plugins and runtime environments have been adapted, while continuing to refine allocation policies for whole devices and partitioned resources.
- **Strengthen inference-service governance:** Improve input-attribute-based routing policies and establish mechanisms for adjusting traffic weights periodically and in response to operating conditions. Lightweight classification or intent recognition components may be introduced later, with their outputs used as routing tags by the AI gateway, gradually enabling semantic model selection for AI agent scenarios.
- **Explore real-time dynamic traffic weighting:** Once inference-engine metrics, service discovery, monitoring systems, and weight-control mechanisms are in place, investigate dynamic traffic allocation based on real-time latency, concurrency levels, and node health.
- **Introduce Kueue:** Add queue priority and quota management when compute sharing across departments and batch-training workloads reach sufficient scale.
- **Consolidate lessons learned:** Continue documenting experience with heterogeneous AI clusters in city commercial banks and contribute scenario-specific requirements back to the HAMi and Higress communities.
