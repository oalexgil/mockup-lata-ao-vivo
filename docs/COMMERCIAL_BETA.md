# Commercial Beta Experiment

## Goal

Validate Mockup Vision as a product before financing unlimited image generation or building a complete subscription stack.

The beta is designed to test:

1. activation — can a new user complete a mockup?
2. value — does preserving the original artwork solve a painful enough problem?
3. willingness to pay — does the Creator offer produce checkout/waitlist intent?

## Offer under test

### Free

- existing-photo / existing-scene import;
- original-artwork composition;
- surface mapping and manual correction;
- PNG export;
- small daily allowance of integrated AI scene generation.

Default:

```env
FREE_SCENE_GENERATIONS_PER_DAY=3
```

### Creator Beta

Default price hypothesis:

```env
BETA_CREATOR_PRICE_BRL=29
```

The landing page **does not claim payment is active** unless:

```env
BETA_CHECKOUT_URL=https://...
```

is configured.

A waitlist can be tested independently with:

```env
BETA_WAITLIST_URL=https://...
```

## Cost-control model

Mockup Vision treats generation as replaceable.

```text
integrated generation available?
        │
        ├─ yes → use beta allowance
        │
        └─ no  → import scene
                     ↓
              mapping still works
                     ↓
              artwork still applies
                     ↓
                 export
```

This prevents a provider outage, free-tier exhaustion or pricing change from disabling the product.

## Cloudflare budget guard

The application uses two beta-only in-memory counters:

- per-IP daily scene allowance;
- global daily scene ceiling.

`SCENE_GLOBAL_DAILY_LIMIT` defaults to 120. It is intentionally conservative and should be reviewed against real provider usage. It is not a substitute for Cloudflare account-level usage/billing controls.

Failed provider calls are refunded from the application scene counter.

## Provider chain

`IMAGE_PROVIDER_ORDER` is evaluated left to right.

Fallback occurs for temporary/provider-capacity style errors such as 402/403/408/409/429/5xx. User/input errors are surfaced instead of silently changing providers.

The Pollinations adapter is intentionally text-only in this beta. Reference-image requests stay on providers that explicitly support the required path; otherwise the user can import the result from another generator.

## What not to build yet

Until there is evidence of repeated external use:

- no complex account system;
- no prepaid-credit ledger;
- no unlimited generation promise;
- no large paid GPU commitment;
- no annual plan;
- no marketplace.

## Validation events to add next

When the beta receives real external traffic, persist only minimal product events:

- landing_view;
- studio_open;
- scene_source = generated | imported;
- artwork_uploaded;
- mapping_completed;
- export_completed;
- creator_cta_clicked;
- checkout_started;
- checkout_completed.

Do not log raw user artwork or reference images as analytics payloads.
