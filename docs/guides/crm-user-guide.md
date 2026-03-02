# Lumentra CRM User Guide

**Version:** 2.1
**Last Updated:** March 2026

---

## Table of Contents

1. [CRM Overview](#1-crm-overview)
2. [CRM Architecture and Data Model](#2-crm-architecture-and-data-model)
3. [Contacts Management](#3-contacts-management)
4. [Contact Lifecycle Management](#4-contact-lifecycle-management)
5. [Lead Tracking](#5-lead-tracking)
6. [Engagement Scoring Deep Dive](#6-engagement-scoring-deep-dive)
7. [VIP Detection and Management](#7-vip-detection-and-management)
8. [Deal Management](#8-deal-management)
9. [Deal Pipeline Configuration](#9-deal-pipeline-configuration)
10. [Kanban Board Usage](#10-kanban-board-usage)
11. [Task Management](#11-task-management)
12. [Task Automation and Workflows](#12-task-automation-and-workflows)
13. [Call History](#13-call-history)
14. [Call Analytics and Reporting](#14-call-analytics-and-reporting)
15. [Activity Tracking](#15-activity-tracking)
16. [Post-Call Automation Engine](#16-post-call-automation-engine)
17. [Contact Segmentation and Filtering](#17-contact-segmentation-and-filtering)
18. [Search and Global Lookup](#18-search-and-global-lookup)
19. [Bulk Operations](#19-bulk-operations)
20. [CRM Dashboard Widgets](#20-crm-dashboard-widgets)
21. [Integration with Voice Agent](#21-integration-with-voice-agent)
22. [Notification System](#22-notification-system)
23. [Escalation Management](#23-escalation-management)
24. [Data Import and Export](#24-data-import-and-export)
25. [Data Privacy and GDPR Compliance](#25-data-privacy-and-gdpr-compliance)
26. [Multi-Tenant Data Isolation](#26-multi-tenant-data-isolation)
27. [Industry-Specific CRM Workflows](#27-industry-specific-crm-workflows)
28. [Advanced Reporting and KPIs](#28-advanced-reporting-and-kpis)
29. [Troubleshooting and Common Issues](#29-troubleshooting-and-common-issues)
30. [API Reference for CRM Operations](#30-api-reference-for-crm-operations)
31. [Appendix A: Complete Field Reference](#appendix-a-complete-field-reference)
32. [Appendix B: Engagement Score Examples](#appendix-b-engagement-score-calculation-examples)
33. [Appendix C: Industry Pipeline Reference](#appendix-c-industry-pipeline-reference)
34. [Appendix D: Industry-Specific Terminology](#appendix-d-industry-specific-terminology)
35. [Appendix E: Glossary](#appendix-e-glossary)

---

## 1. CRM Overview

### What Is the Lumentra CRM?

The Lumentra CRM is a built-in customer relationship management system designed specifically for businesses that use Lumentra's voice AI platform. It provides a unified view of every customer interaction -- from the first phone call through booking, follow-up, and long-term engagement -- without requiring a separate CRM product.

Unlike standalone CRM systems that require manual data entry and integration work, the Lumentra CRM is deeply woven into the voice agent infrastructure. Every call, every booking, and every customer interaction automatically flows into the CRM, creating a real-time picture of customer engagement without any manual effort from business owners or staff.

The CRM supports multi-tenant isolation, meaning each business using the Lumentra platform has its own private database partition with no data leakage between tenants. All queries, filters, and automation rules operate within the boundaries of a single tenant.

### How the CRM Integrates with Voice Calls

Every inbound phone call handled by the Lumentra voice agent feeds directly into the CRM:

1. **Automatic Contact Creation.** When a caller's phone number is not recognized, the system creates a new contact record automatically. If the caller is already in the database, their existing record is updated with the new interaction. The lookup uses a high-performance cache with a target response time under 50 milliseconds.

2. **Post-Call Automation.** After every call is logged, the system runs a set of automation rules that can create deals, generate follow-up tasks, update lead statuses, and even upgrade contacts to VIP status -- all without manual intervention. These rules execute asynchronously so they never block the call logging response.

3. **Real-Time Engagement Scoring.** Each call, booking, and interaction contributes to a contact's engagement score. This score is recalculated based on recency, frequency, conversion rate, and loyalty. The scoring algorithm uses five weighted factors that sum to a maximum of 100 points.

4. **Linked Records.** Calls are linked to contacts, bookings, deals, and tasks. Clicking into any call shows its full context: who called, what they needed, whether a booking was made, and what follow-up is required.

5. **Sentiment Analysis.** Every call receives a sentiment score between -1.0 (very negative) and +1.0 (very positive). This feeds into the contact's sentiment average, helping identify customers who may be at risk of churning.

6. **Intent Detection.** The voice agent detects and records caller intents (such as "booking", "hours_inquiry", "pricing", "cancellation") which are stored on the call record and available for reporting and segmentation.

### Core CRM Modules

| Module        | Purpose                             |
| ------------- | ----------------------------------- |
| Contacts      | Customer database with metrics      |
| Deals         | Sales pipeline with Kanban board    |
| Tasks         | Follow-ups and action items         |
| Call History  | Call log with transcripts           |
| Analytics     | Charts and conversion metrics       |
| Notifications | Booking confirmations and reminders |

### Who Should Use This Guide

This guide is intended for:

- **Business Owners** who want to understand how their customer data is organized and how to leverage the CRM for growth.
- **Office Managers and Receptionists** who handle day-to-day contact management, deal tracking, and task completion.
- **Administrators** who configure the CRM settings, notification templates, and pipeline stages for their business.
- **Developers** who integrate with the CRM via the REST API or build custom workflows on top of the platform.

### System Requirements

To use the Lumentra CRM dashboard effectively, you need:

- A modern web browser (Chrome 100+, Firefox 100+, Safari 16+, Edge 100+)
- A stable internet connection (recommended 5 Mbps or faster)
- A screen resolution of at least 1280x720 (1920x1080 recommended)
- A valid Lumentra account with CRM access enabled

The CRM API requires:

- Valid authentication token (session-based or API key)
- The X-Tenant-ID header on every request
- HTTPS connection for all API calls

---

## 2. CRM Architecture and Data Model

### Entity Relationship Overview

The Lumentra CRM is built around five core entities that are interconnected through foreign key relationships. Understanding how these entities relate to each other is essential for effective use of the system.

**Core Entities:**

- **Contacts** -- The central entity. Every person who calls or interacts with your business has a contact record.
- **Calls** -- Every phone call handled by the voice agent is stored as a call record, linked to a contact.
- **Bookings** -- Appointments, reservations, or service orders created during calls, linked to both a contact and a call.
- **Deals** -- Business opportunities that move through your sales pipeline, linked to a contact and optionally a call.
- **Tasks** -- Follow-up items and action items, linked to a contact, a deal, and/or a call.

**Supporting Entities:**

- **Contact Notes** -- Free-form text notes attached to contacts, with type classification and pinning.
- **Contact Activity** -- A chronological audit log of every action taken on a contact.
- **Notifications** -- Messages sent to contacts via email, SMS, or push.
- **Notification Templates** -- Configurable message templates with variable substitution.
- **Notification Preferences** -- Per-tenant settings controlling which notification types are enabled per channel.
- **Resources** -- Staff, rooms, equipment, or services used in scheduling.
- **Availability Slots** -- Time slots available for booking, linked to resources.

### Data Flow: From Call to CRM

The following sequence describes how data flows through the system when a customer calls:

1. **Inbound call arrives** via SignalWire SIP trunk, routed through LiveKit SIP to the voice agent.
2. **Phone lookup** -- The agent calls the internal API endpoint `POST /api/contacts/find-or-create` with the caller's phone number. The system checks the in-memory cache first (sub-50ms), then falls back to a database query.
3. **Contact record resolved** -- Either an existing contact is found and returned, or a new contact is created with source set to "call", status "active", and lead_status "new".
4. **Call proceeds** -- The voice agent conducts the conversation, detecting intents and recording the transcript.
5. **Call ends** -- The agent logs the call via the internal API with full metadata: duration, outcome, transcript, summary, sentiment, and intents.
6. **Post-call automation fires** -- Five automation rules are evaluated sequentially (see Section 16). These can create deals, tasks, and update contact status.
7. **Engagement score recalculated** -- The contact's engagement score is updated based on the new call data.
8. **Notifications triggered** -- If a booking was made, confirmation notifications are queued for delivery.

### Multi-Tenant Isolation

Every entity in the CRM includes a `tenant_id` column that acts as a partition key. The system enforces tenant isolation at multiple levels:

- **Database Level:** PostgreSQL Row-Level Security (RLS) policies ensure that queries can only return data belonging to the authenticated tenant.
- **Application Level:** Every API route extracts the tenant ID from the authenticated session and includes it as a WHERE clause condition. This provides defense-in-depth even if RLS is bypassed.
- **Cache Level:** The contact lookup cache is keyed by both tenant ID and phone number, preventing cross-tenant cache leakage.

### Database Tables Summary

| Table                    | Row Count Typical        | Primary Key |
| ------------------------ | ------------------------ | ----------- |
| contacts                 | 100 - 50,000 per tenant  | UUID        |
| calls                    | 500 - 200,000 per tenant | UUID        |
| bookings                 | 100 - 100,000 per tenant | UUID        |
| deals                    | 50 - 10,000 per tenant   | UUID        |
| tasks                    | 50 - 5,000 per tenant    | UUID        |
| contact_notes            | Varies                   | UUID        |
| contact_activity         | Varies                   | UUID        |
| notifications            | Varies                   | UUID        |
| notification_templates   | 6-20 per tenant          | UUID        |
| notification_preferences | 1-11 per tenant          | UUID        |

### Foreign Key Relationships

- `calls.contact_id` references `contacts.id`
- `calls.booking_id` references `bookings.id`
- `bookings.contact_id` references `contacts.id`
- `bookings.call_id` references `calls.id`
- `deals.contact_id` references `contacts.id`
- `deals.call_id` references `calls.id`
- `tasks.contact_id` references `contacts.id`
- `tasks.deal_id` references `deals.id`
- `tasks.call_id` references `calls.id`
- `contact_notes.contact_id` references `contacts.id`
- `contact_notes.call_id` references `calls.id`
- `contact_notes.booking_id` references `bookings.id`
- `contact_activity.contact_id` references `contacts.id`
- `notifications.contact_id` references `contacts.id`
- `notifications.booking_id` references `bookings.id`
- `notifications.call_id` references `calls.id`

### How Contacts Connect to Everything

The contact record is the hub of the CRM. From a single contact, you can trace:

- **All calls made by this person** -- via `calls.contact_id`
- **All bookings made by this person** -- via `bookings.contact_id`
- **All deals associated with this person** -- via `deals.contact_id`
- **All tasks related to this person** -- via `tasks.contact_id`
- **All notes written about this person** -- via `contact_notes.contact_id`
- **All activities logged for this person** -- via `contact_activity.contact_id`
- **All notifications sent to this person** -- via `notifications.contact_id`

This centralized design means that opening a contact's detail view gives you a complete 360-degree picture of the customer relationship.

---

## 3. Contacts Management

### Navigating to Contacts

Open the dashboard and select **Contacts** from the sidebar navigation. The contacts list displays all customers in your database with summary information in a sortable, searchable table.

### Contacts List View

The contacts table shows the following columns:

| Column           | Description                     |
| ---------------- | ------------------------------- |
| **Name**         | Contact name and phone number   |
| **Email**        | Email address or a dash         |
| **Status**       | Badge: Active, Inactive, etc.   |
| **Bookings**     | Total booking count             |
| **Calls**        | Total call count                |
| **Score**        | Engagement score (0-100)        |
| **Last Contact** | Date of most recent interaction |

The "Bookings" column header adapts to your industry terminology. For restaurants it shows "Reservations", for salons it shows "Appointments", and so on.

The engagement score column is color-coded:

- **Green (80+):** Highly engaged, VIP-level customers
- **Amber (50-79):** Moderately engaged customers
- **Gray (below 50):** Low engagement, may need re-engagement

### Searching Contacts

Use the search bar at the top of the page to find contacts by name, email, or phone number. The search is case-insensitive and applies a 300ms debounce to avoid excessive queries while you type.

The search operates as an ILIKE pattern match, meaning partial matches work. For example, searching for "john" will match "John Smith", "Johnson", and "john@example.com".

### Filtering Contacts

Click the **Filters** button to narrow the contacts list. Available filters include:

- **Status:** active, inactive, blocked, vip, churned (multi-select)
- **Lead Status:** new, contacted, qualified, converted, lost (multi-select)
- **Source:** call, booking, import, manual, sms, web (multi-select)
- **Tags:** filter by one or more tags
- **Has Bookings:** yes/no
- **Has Calls:** yes/no
- **Date Ranges:** created_after, created_before, last_contact_after, last_contact_before

Filters can be combined. For example, you can filter for VIP contacts who were created after January 2026 and have made at least one booking.

### Sorting

Click any sortable column header (Name, Bookings, Calls, Score, Last Contact) to sort ascending. Click again to reverse the sort order. The default sort is by `last_contact_at` in descending order, showing the most recently active contacts first.

### Pagination

The contacts list loads 20 records per page by default. Use the pagination controls at the bottom of the table to navigate between pages or change the number of records per page. The API supports a maximum of 100 records per page.

### Selecting Multiple Contacts

Check the checkbox next to individual contacts, or use the header checkbox to select all visible contacts. When contacts are selected, a selection indicator appears showing the count and a **Clear** button.

Bulk operations available for selected contacts:

- **Bulk Tag:** Add a tag to all selected contacts at once.

### Creating a Contact

1. Click the **Add Contact** button in the top-right corner.
2. Fill in the contact form:
   - **Phone Number** (required): The contact's phone number. This field cannot be changed after creation. The system normalizes the phone number to E.164 format automatically.
   - **First Name** (optional)
   - **Last Name** (optional)
   - **Email** (optional): Must be a valid email format. Stored in lowercase.
   - **Company** (optional)
   - **Notes** (optional): Free-text notes about this contact.
3. Click **Add Contact** to save.

New contacts are created with:

- Status: `active`
- Lead Status: `new`
- Source: `manual`
- Engagement Score: `0`
- All metric counters: `0`
- Preferred Language: `en`

If a contact with the same phone number already exists for your tenant, the system returns a 409 Conflict error.

### Viewing Contact Details

Click any row in the contacts table to open the contact detail drawer on the right side of the screen. The detail view includes:

**Profile Section:**

- Avatar initial, full name, and company
- Tags displayed as badges
- Phone number, email address, and company
- Three stat cards: Bookings count, Calls count, and Engagement Score
- Lifetime value (if greater than $0), displayed in a highlighted card

**Tabs:**

- **Activity** -- Chronological timeline of all interactions (calls, bookings, SMS, notes, status changes)
- **Notes** -- All notes attached to the contact, with pinned notes shown first
- **Details** -- Full contact information including status, lead status, source, first/last contact dates, preferred language, preferred contact method, and communication preferences

### Editing a Contact

1. Open the contact detail drawer.
2. Click the **Edit** (pencil) icon in the drawer header.
3. Modify the fields you want to update:
   - Email, first name, last name, company, notes
   - Status: active, inactive, blocked, vip, churned
   - Lead Status: new, contacted, qualified, converted, lost
   - Preferred Contact Method: phone, sms, email
   - Preferred Contact Time (free text, e.g., "mornings")
   - Preferred Language (ISO 639-1 code, e.g., "en", "es")
   - Timezone (IANA format, e.g., "America/New_York")
   - Communication Preferences: do_not_call, do_not_sms, do_not_email, marketing_opt_in
   - Tags (array of strings)
   - Custom Fields (JSON object for business-specific data)
4. Click **Save Changes**.

Note: The phone number cannot be changed after the contact is created. If a contact's phone number needs to change, create a new contact and use the merge feature.

### Deleting a Contact

1. Open the contact detail drawer.
2. Click the **Delete** (trash) icon in the drawer header.
3. Confirm the deletion when prompted.

Deletion is a soft delete -- the contact's status is set to `inactive` rather than being permanently removed. All linked calls, bookings, and notes are preserved. The soft delete also logs a `status_changed` activity entry for audit purposes.

### Communication Preferences

Each contact has four compliance-related flags:

| Flag               | Default | Meaning                   |
| ------------------ | ------- | ------------------------- |
| `do_not_call`      | false   | Opted out of phone calls  |
| `do_not_sms`       | false   | Opted out of SMS messages |
| `do_not_email`     | false   | Opted out of email        |
| `marketing_opt_in` | false   | Consented to marketing    |

These flags are shown in the Details tab with green ("OK") or red ("No") indicators. When `marketing_opt_in` is set to true, the system records the timestamp in `marketing_opt_in_at`.

The notification system respects these flags. If `do_not_sms` is true, SMS notifications will be skipped for that contact. If `do_not_email` is true, email notifications will be skipped. Marketing-type notifications require `marketing_opt_in` to be true.

### Tags

Tags are free-form text labels attached to contacts. They appear as badges in the contact detail view. Tags are useful for segmentation, filtering, and organizing contacts into groups.

**Common Tag Examples:**

- "vip-guest", "repeat-customer", "event-booking"
- "insurance-verified", "new-patient", "referral"
- "large-party", "dietary-restrictions", "special-occasion"
- "fleet-account", "warranty-active", "commercial"

**Adding Tags:**

- Edit the contact and update the tags array, or
- Use the API endpoint `PATCH /api/contacts/:id/tags` with `{ "add": ["tag1", "tag2"] }`

**Removing Tags:**

- Use `PATCH /api/contacts/:id/tags` with `{ "remove": ["tag1"] }`

**Bulk Tagging:**

- Select multiple contacts in the table, then use the bulk tag operation to add a tag to all selected contacts. This calls `POST /api/contacts/bulk/tags` with the list of contact IDs and the tag to add.

### Contact Notes

Notes provide a way to record observations, preferences, and follow-up items against a contact.

**Note Types:**

| Type           | Use Case                    |
| -------------- | --------------------------- |
| `general`      | General-purpose notes       |
| `call_summary` | Auto-generated call summary |
| `booking_note` | Notes about a booking       |
| `preference`   | Customer preferences        |
| `complaint`    | Customer complaints         |
| `compliment`   | Positive feedback           |
| `follow_up`    | Items needing follow-up     |
| `internal`     | Internal-only notes         |
| `system`       | System-generated notes      |

Notes can be **pinned** to appear at the top of the list, and marked as **private** to restrict visibility. Each note records the author's name and creation timestamp.

Notes are ordered with pinned notes first, then by creation date descending.

**Creating a Note:**

1. Open the contact detail drawer and navigate to the Notes tab.
2. Click the "Add Note" button.
3. Select the note type from the dropdown.
4. Enter the note content (required).
5. Optionally check "Pin this note" to keep it at the top.
6. Optionally check "Private" to restrict visibility.
7. Click Save.

### Merging Duplicate Contacts

When the same customer has multiple contact records (for example, they called from two different phone numbers), you can merge them:

1. Identify the primary contact (the record you want to keep).
2. Identify the secondary contacts (the duplicates to merge into the primary).
3. Call `POST /api/contacts/merge` with `primary_id` and `secondary_ids`.

The merge operation performs the following steps:

- Moves all calls from secondary contacts to the primary contact
- Moves all bookings from secondary contacts to the primary contact
- Moves all notes from secondary contacts to the primary contact
- Moves all activity history from secondary contacts to the primary contact
- Combines metric counters (total_calls, total_bookings, lifetime_value_cents, etc.) by summing them
- Merges tags (union of all tags, no duplicates)
- Uses the earliest `first_contact_at` and the latest `last_contact_at`
- Soft-deletes secondary contacts (sets status to `inactive`)
- Logs a `merged` activity entry on the primary contact
- Invalidates the cache for all affected contacts

### Custom Fields

The `custom_fields` column is a JSONB object that allows you to store arbitrary business-specific data. This is useful for industry-specific attributes that do not fit into the standard contact schema.

**Example custom fields by industry:**

| Industry     | Custom Field Examples               |
| ------------ | ----------------------------------- |
| Medical      | insurance_id, primary_care_provider |
| Restaurant   | dietary_restrictions, seating_pref  |
| Hotel        | loyalty_tier, room_preference       |
| Salon        | stylist_preference, hair_type       |
| Auto Service | vehicle_make, vehicle_year          |

Custom fields are stored as key-value pairs and can be queried through the API but are not indexed for search. Use tags for attributes that need filtering.

---

## 4. Contact Lifecycle Management

### From Anonymous Caller to VIP

Every contact in the Lumentra CRM follows a natural lifecycle that progresses from first interaction to long-term customer relationship. Understanding this lifecycle helps businesses identify opportunities for engagement at each stage.

**Stage 1: Anonymous Caller**

When someone calls your business for the first time, the voice agent performs a phone lookup. If the number is not found, a new contact is created with minimal information:

- Phone number (the only guaranteed field)
- Source: "call"
- Status: "active"
- Lead Status: "new"
- Engagement Score: 0

At this point, the contact is essentially anonymous -- just a phone number.

**Stage 2: Identified Contact**

During the call, the voice agent may collect the caller's name. If the caller provides their name, it is stored on the contact record. After the call, the post-call automation may also update the contact based on the call outcome. The contact now has:

- Name (first and/or last)
- At least one call record with transcript and summary
- A detected intent (inquiry, booking, support, etc.)
- An initial engagement score (typically 15-25 for a single call)

**Stage 3: Qualified Lead**

After multiple interactions or a booking, the contact becomes a qualified lead. Indicators include:

- Lead status progressed to "contacted" or "qualified"
- Multiple calls in the activity history
- Possibly a deal created in the pipeline
- Engagement score in the 30-59 range (warm)
- Tags added based on interests or needs

**Stage 4: Converted Customer**

When the contact completes a booking or purchase, the system automatically:

- Updates lead status to "converted"
- Creates a deal at the completed/won stage
- Increments the lifetime value counter
- Boosts the engagement score via conversion rate and booking frequency factors

**Stage 5: Repeat Customer**

Repeat customers show up through increasing metric counters:

- Multiple completed bookings
- Rising engagement score (60-79 range, "hot" level)
- Consistent call frequency
- Growing lifetime value

**Stage 6: VIP Status**

The system automatically upgrades contacts to VIP status when they meet all three criteria:

- 3 or more total calls
- Engagement score of 80 or higher
- Current status is not already VIP

VIP contacts receive:

- A distinct badge in the contacts list
- Priority consideration in engagement-level queries
- VIP-level engagement classification regardless of score drops (once the status is set manually, it persists unless explicitly changed)

**Stage 7: Churned Contact**

Contacts who stop engaging eventually see their engagement score decay through the recency factor. If a contact has not interacted in over 90 days, their recency score drops to 0, significantly reducing their overall engagement score. Business owners can manually set the status to "churned" to flag these contacts for re-engagement campaigns.

### Status State Machine

Contact status transitions follow these rules:

- **active** -- The default state for all new contacts. Can transition to any other status.
- **inactive** -- Set when a contact is soft-deleted or merged as a secondary. Can be reactivated to "active".
- **blocked** -- Set manually when a contact should be excluded from all communications. Can be unblocked to "active".
- **vip** -- Set automatically by post-call automation or manually by staff. Can transition to any other status.
- **churned** -- Set manually to flag disengaged contacts. Can be reactivated to "active" if the contact re-engages.

### Lead Status Funnel

The lead status is separate from the contact status and tracks the sales/conversion journey:

```
New --> Contacted --> Qualified --> Converted
                                       |
                                     Lost
```

Lead status transitions are mostly manual, with two automatic transitions:

- **new** is set automatically when a first-time caller makes an inquiry
- **converted** is set automatically when a call results in a booking

---

## 5. Lead Tracking

### Lead Status Flow

Every contact has an optional `lead_status` field that tracks where they are in the customer journey. The five lead statuses form a funnel:

```
New --> Contacted --> Qualified --> Converted
                                       |
                                     Lost
```

| Status        | Description                         |
| ------------- | ----------------------------------- |
| **new**       | First-time caller or newly imported |
| **contacted** | Business has reached out            |
| **qualified** | Evaluated as a genuine prospect     |
| **converted** | Completed a booking or purchase     |
| **lost**      | Did not convert, no longer pursued  |

### Automatic Lead Status Updates

The post-call automation system updates lead status in two scenarios:

1. **Booking outcome:** When a call results in a booking, the contact's lead_status is automatically set to `converted`.
2. **First-time inquiry:** When a first-time caller's call is classified as an `inquiry`, the lead_status is confirmed as `new` (the default).

All other transitions (contacted, qualified, lost) are manual -- update them through the contact edit form or the API.

### Best Practices for Lead Management

**Daily Review Process:**

1. Filter contacts by lead_status = "new" to see fresh leads
2. Review the call summary and intents for each new lead
3. Move promising leads to "contacted" after reaching out
4. Mark unresponsive or unqualified leads as "lost"

**Weekly Pipeline Review:**

1. Filter by lead_status = "qualified" to review the sales pipeline
2. Check the engagement score trend -- is it rising or falling?
3. Create follow-up tasks for stalled leads
4. Review the conversion rate metric on the analytics page

**Re-Engagement Strategy:**

1. Filter by lead_status = "lost" and last_contact_after a recent date
2. Review the call transcripts to understand why they were lost
3. Consider reaching out with a special offer or updated information
4. If re-engaged, move back to "contacted"

### Lead Scoring Quick Reference

Combine lead_status with engagement_score to prioritize leads:

| Lead Status | Score 0-29    | Score 30-59       | Score 60-79     | Score 80+ |
| ----------- | ------------- | ----------------- | --------------- | --------- |
| new         | Low priority  | Follow up soon    | Call today      | Immediate |
| contacted   | Revisit later | Nurture weekly    | Push to qualify | Urgent    |
| qualified   | At risk       | Standard cadence  | Near close      | Close now |
| lost        | Archive       | Revisit quarterly | Re-engage       | Win back  |

---

## 6. Engagement Scoring Deep Dive

### How the Engagement Score Works

Each contact has an `engagement_score` from 0 to 100 that quantifies how engaged they are with your business. The score is calculated from five weighted factors that sum to exactly 100 maximum points.

The score is recalculated:

- After every call is logged (via post-call automation)
- When a booking status changes
- When explicitly triggered via the API (`POST /api/contacts/:id/recalculate-score`)
- During batch recalculation operations

### Scoring Factors and Weights

| Factor            | Weight | Max Contribution |
| ----------------- | ------ | ---------------- |
| Booking Frequency | 25     | 25 points        |
| Recency           | 25     | 25 points        |
| Call Frequency    | 20     | 20 points        |
| Conversion Rate   | 20     | 20 points        |
| Loyalty           | 10     | 10 points        |

### Factor 1: Booking Frequency (25 points)

Measures the number of bookings in the last 90 days. Each booking adds 33 points to the raw score, capped at 100.

| Bookings (90 days) | Raw Score |
| ------------------ | --------- |
| 0                  | 0         |
| 1                  | 33        |
| 2                  | 66        |
| 3+                 | 100       |

**Contribution Calculation:**

Contribution = (Raw Score \* Weight) / 100

Example: 2 bookings in 90 days: Raw Score 66, Contribution = (66 \* 25) / 100 = 16.5 points

### Factor 2: Recency (25 points)

The recency factor measures how recently the contact last interacted with your business. It uses the most recent of `last_call_date` or `last_booking_date`.

**Recency Score Thresholds:**

| Days Since Last Contact | Raw Score |
| ----------------------- | --------- |
| 0-7 days                | 100       |
| 8-14 days               | 80        |
| 15-30 days              | 60        |
| 31-60 days              | 40        |
| 61-90 days              | 20        |
| 91+ days                | 0         |

Example: Contact last seen 10 days ago: Raw Score 80, Contribution = (80 \* 25) / 100 = 20 points

### Factor 3: Call Frequency (20 points)

Measures the number of calls in the last 30 days. Each call adds 25 points to the raw score, capped at 100.

| Calls (30 days) | Raw Score |
| --------------- | --------- |
| 0               | 0         |
| 1               | 25        |
| 2               | 50        |
| 3               | 75        |
| 4+              | 100       |

Example: 3 calls in 30 days: Raw Score 75, Contribution = (75 \* 20) / 100 = 15 points

### Factor 4: Conversion Rate (20 points)

Measures the percentage of calls that resulted in a booking outcome. The raw score is double the conversion percentage, capped at 100. This means a 50% or higher conversion rate achieves the maximum raw score.

| Conversion Rate | Raw Score |
| --------------- | --------- |
| 0%              | 0         |
| 25%             | 50        |
| 50%+            | 100       |

Example: 2 out of 4 calls resulted in bookings (50%): Raw Score 100, Contribution = (100 \* 20) / 100 = 20 points

### Factor 5: Loyalty (10 points)

Measures the "show rate" -- the percentage of total bookings that were completed (as opposed to cancelled or no-showed). A 100% show rate yields the maximum raw score.

| Show Rate | Raw Score |
| --------- | --------- |
| 0%        | 0         |
| 50%       | 50        |
| 100%      | 100       |

Example: 8 completed out of 10 total bookings (80%): Raw Score 80, Contribution = (80 \* 10) / 100 = 8 points

### Engagement Levels

The total score maps to four engagement levels:

| Level | Score Range | Meaning                 |
| ----- | ----------- | ----------------------- |
| VIP   | 80-100      | Highest-value customers |
| Hot   | 60-79       | Highly engaged          |
| Warm  | 30-59       | Moderate engagement     |
| Cold  | 0-29        | Low or no engagement    |

A contact's engagement level is stored on the contact record as `engagement_level` and is updated every time the score is recalculated.

Special case: If a contact's status is manually set to "vip", their engagement level is always classified as "vip" regardless of score.

### Score Decay Over Time

The engagement score naturally decays over time through the recency factor. If a contact stops interacting:

- After 7 days: Recency drops from 100 to 80 (-5 points contribution)
- After 14 days: Recency drops to 60 (-10 points total)
- After 30 days: Recency drops to 40 (-15 points total)
- After 60 days: Recency drops to 20 (-20 points total)
- After 90 days: Recency drops to 0 (-25 points total)

This means that even a previously highly-engaged customer will see their score drop by up to 25 points if they go silent for 3 months.

### Viewing the Engagement Breakdown

To view the detailed factor breakdown for any contact, call:

```
GET /api/contacts/:id/engagement
```

The response includes:

- `score`: The total engagement score (0-100)
- `level`: The engagement level (cold, warm, hot, vip)
- `metrics`: Raw metrics including totalCalls, totalBookings, completedBookings, cancelledBookings, lastCallDate, lastBookingDate, avgCallDuration, responseRate, daysSinceLastContact
- `factors`: An array of five factor objects, each with:
  - `name`: Factor name (e.g., "Recency")
  - `value`: The raw metric value
  - `weight`: The factor weight
  - `contribution`: The actual points contributed

### Batch Recalculation

For administrative purposes, you can trigger a batch recalculation of all engagement scores for a tenant. This is useful after a data import or migration. The batch operation processes contacts sequentially and returns a summary of updated and failed records.

The batch endpoint processes every contact in the tenant, recalculating scores and updating both `engagement_score` and `engagement_level` fields along with an `engagement_updated_at` timestamp.

---

## 7. VIP Detection and Management

### Automatic VIP Upgrade Criteria

The post-call automation system evaluates VIP eligibility after every call. A contact is automatically upgraded to VIP status when all three conditions are met simultaneously:

| Criterion        | Threshold       | Field Checked              |
| ---------------- | --------------- | -------------------------- |
| Total calls      | 3 or more       | `contact.total_calls`      |
| Engagement score | 80 or higher    | `contact.engagement_score` |
| Current status   | Not already VIP | `contact.status`           |

When all three are true, the system executes:

```
UPDATE contacts SET status = 'vip' WHERE id = :contactId
```

### Why These Thresholds?

The three-criteria approach prevents false VIP designations:

- **3+ calls** ensures the contact has had meaningful interaction with your business, not just a single lucky call.
- **80+ engagement score** confirms the contact is actively engaged across multiple dimensions (recent, frequent, converting, loyal).
- **Not already VIP** avoids redundant updates and unnecessary activity log entries.

### VIP-Specific Benefits

Once a contact reaches VIP status, they receive:

- **Visual distinction** -- A VIP badge appears on their contact card in the list and detail views.
- **Engagement level override** -- Their engagement level is always classified as "vip" regardless of the numeric score.
- **Priority in queries** -- When querying contacts by engagement level, VIP contacts appear in the highest tier.
- **Persistent status** -- Unlike engagement scores which decay, VIP status persists until manually changed. Even if the engagement score drops below 80, the status remains VIP.

### Manual VIP Assignment

Business owners can manually set any contact to VIP status through:

1. The contact edit form (set Status to "vip")
2. The status update API: `PATCH /api/contacts/:id/status` with `{ "status": "vip" }`

Manual VIP assignment is useful for:

- Long-standing customers who may not meet the automated threshold
- High-profile individuals (celebrities, major accounts)
- Referral sources who bring significant business
- Contacts with high lifetime value but low call frequency

### Revoking VIP Status

VIP status can be removed by:

1. Manually setting the status to "active", "inactive", "blocked", or "churned"
2. Soft-deleting the contact (status becomes "inactive")

The system never automatically revokes VIP status. Once set, it remains until a human explicitly changes it.

---

## 8. Deal Management

### What Is a Deal?

A deal represents a business opportunity moving through your sales pipeline. Depending on your industry, deals may be called by different names:

| Industry          | Deal Label    | Example Name               |
| ----------------- | ------------- | -------------------------- |
| Default / Generic | Deal          | "Website Redesign Project" |
| Medical / Dental  | Case          | "John Smith - Case"        |
| Restaurant        | Reservation   | "Jane Doe - Reservation"   |
| Hotel / Motel     | Booking       | "Guest Booking"            |
| Salon             | Appointment   | "Haircut Appointment"      |
| Auto Service      | Service Order | "Oil Change Service Order" |

### Navigating to Deals

Select **Pipeline** from the sidebar navigation. The deals page displays a Kanban board showing all active deals organized by stage.

### Creating a Deal

1. Click the **Add [Deal Label]** button in the top-right corner.
2. Fill in the deal form:
   - **Name** (required): A descriptive name for the deal.
   - **Company** (optional): The company associated with this deal.
   - **Amount ($)** (optional): The monetary value. Enter as dollars; stored internally as cents.
   - **Expected Close** (optional): The expected close date.
   - **Stage** (optional): The initial stage. Defaults to the first stage in your industry pipeline.
   - **Contact** (optional): Link to an existing contact.
   - **Description** (optional): Additional details.
3. Click **Add [Deal Label]** to save.

### Editing a Deal

Open the deal form by clicking a deal card. Update the fields and click **Save Changes**. You can change the name, company, amount, expected close date, stage, contact link, and description.

### Archiving a Deal

Deals are soft-deleted (archived) rather than permanently removed. An archived deal sets the `archived_at` timestamp and is excluded from pipeline views and searches. To archive a deal, use `DELETE /api/deals/:id`.

### Automatic Deal Creation

The post-call automation creates deals automatically in two scenarios:

1. **Booking outcome:** When a call results in a booking, a deal is created at the completed/won stage with source set to `call`. Example: "John Smith - Case" (for medical) or "Jane Doe - Reservation" (for restaurant).

2. **First-time inquiry:** When a first-time caller's call is classified as an `inquiry`, a deal is created at the default/initial stage with source set to `call`. Example: "John Smith - New Case".

### Win/Loss Tracking

Deals that reach a terminal stage are considered closed:

- **Won/Completed:** Deals that reach the industry's completed stage (e.g., "won", "completed", "checked_out"). These contribute to revenue metrics.
- **Lost/Cancelled:** Deals that reach the industry's cancelled stage (e.g., "lost", "cancelled"). These contribute to loss metrics.
- **No-Show:** For industries that track no-shows (medical, dental, restaurant, salon), a separate terminal stage captures these.

### Deal Fields Reference

| Field            | Type      | Description               |
| ---------------- | --------- | ------------------------- |
| `name`           | Text      | Deal name (required)      |
| `description`    | Text      | Additional details        |
| `company`        | Text      | Associated company        |
| `stage`          | Text      | Current pipeline stage    |
| `sort_index`     | SmallInt  | Position within column    |
| `amount_cents`   | Integer   | Deal value in cents       |
| `expected_close` | Date      | Expected close date       |
| `contact_id`     | UUID      | Linked contact            |
| `call_id`        | UUID      | Originating call          |
| `source`         | Enum      | call, web, manual, import |
| `created_by`     | Text      | Creator identifier        |
| `archived_at`    | Timestamp | Soft delete timestamp     |

---

## 9. Deal Pipeline Configuration

### Industry-Specific Pipeline Stages

Lumentra adapts the pipeline stages to match your industry. Each industry has a unique set of stages that reflect the natural workflow of that business type.

### Default (Generic B2B) Pipeline

| Stage       | Color  | Terminal |
| ----------- | ------ | -------- |
| New         | Blue   | No       |
| Contacted   | Cyan   | No       |
| Qualified   | Amber  | No       |
| Proposal    | Purple | No       |
| Negotiation | Orange | No       |
| Won         | Green  | Yes      |
| Lost        | Red    | Yes      |

- Default Stage: new / Completed Stage: won / Cancelled Stage: lost

### Medical and Dental Pipeline

| Stage     | Color  | Terminal |
| --------- | ------ | -------- |
| Inquiry   | Blue   | No       |
| Scheduled | Cyan   | No       |
| Confirmed | Amber  | No       |
| Completed | Green  | Yes      |
| No-Show   | Orange | Yes      |
| Cancelled | Red    | Yes      |

- Default Stage: inquiry / Completed Stage: completed / Cancelled Stage: cancelled

### Restaurant Pipeline

| Stage     | Color  | Terminal |
| --------- | ------ | -------- |
| Inquiry   | Blue   | No       |
| Reserved  | Cyan   | No       |
| Confirmed | Amber  | No       |
| Seated    | Purple | No       |
| Completed | Green  | Yes      |
| No-Show   | Orange | Yes      |
| Cancelled | Red    | Yes      |

- Default Stage: inquiry / Completed Stage: completed / Cancelled Stage: cancelled

### Hotel and Motel Pipeline

| Stage       | Color  | Terminal |
| ----------- | ------ | -------- |
| Inquiry     | Blue   | No       |
| Reserved    | Cyan   | No       |
| Checked In  | Amber  | No       |
| Checked Out | Green  | Yes      |
| Cancelled   | Red    | Yes      |
| No-Show     | Orange | Yes      |

- Default Stage: inquiry / Completed Stage: checked_out / Cancelled Stage: cancelled

### Salon Pipeline

| Stage     | Color  | Terminal |
| --------- | ------ | -------- |
| Inquiry   | Blue   | No       |
| Booked    | Cyan   | No       |
| Confirmed | Amber  | No       |
| Completed | Green  | Yes      |
| No-Show   | Orange | Yes      |
| Cancelled | Red    | Yes      |

- Default Stage: inquiry / Completed Stage: completed / Cancelled Stage: cancelled

### Auto Service Pipeline

| Stage       | Color  | Terminal |
| ----------- | ------ | -------- |
| Inquiry     | Blue   | No       |
| Quoted      | Cyan   | No       |
| Scheduled   | Amber  | No       |
| In Progress | Purple | No       |
| Completed   | Green  | Yes      |
| Cancelled   | Red    | Yes      |

- Default Stage: inquiry / Completed Stage: completed / Cancelled Stage: cancelled

### Stage Validation

When a deal is moved to a new stage (via drag-and-drop or API), the system validates that the target stage exists in the tenant's industry pipeline. If the stage is invalid, the API returns a 400 error with a message listing all valid stages. The validation is implemented server-side in the `PATCH /api/deals/:id/stage` endpoint, which retrieves valid stages using `getStagesForIndustry(industry)`.

Deals with stages from a different industry (for example, after an industry configuration change) are collected into an "other" bucket in the pipeline view.

---

## 10. Kanban Board Usage

### Pipeline Kanban Board

The pipeline is displayed as a horizontal Kanban board. Each column represents a stage, showing:

- Stage name and color indicator
- Count of deals in that stage
- Total monetary value of deals in that stage
- Individual deal cards

The header shows the total number of deals and the total pipeline value (excluding terminal stages like Won/Lost/Completed).

### Deal Cards

Each deal appears as a card in its stage column, displaying:

- **Deal name** (truncated if too long)
- **Contact name** (if linked to a contact)
- **Company** (if specified, with a building icon)
- **Amount** (formatted as currency, e.g., "$5,000")
- **Expected close date** (relative: "Today", "Tomorrow", "3d", or overdue with red text)

A drag handle appears on hover for drag-and-drop functionality.

### Moving Deals Between Stages

To move a deal to a different stage, drag the deal card from one column and drop it into another. The update happens optimistically (the UI updates immediately) and syncs to the server in the background. If the server update fails, the card reverts to its original position.

The system validates that the target stage is valid for your industry pipeline. You cannot drag a deal to a stage that does not exist in your industry configuration.

### Kanban Filtering

The pipeline view supports filtering by:

- **Search:** Filter deal cards by name or contact name
- **Date range:** Show only deals created within a specific period
- **Source:** Filter by deal source (call, web, manual, import)

### Pipeline View Data Structure

The pipeline API (`GET /api/deals/pipeline`) returns a stages array where each entry contains:

- `stage`: The stage identifier string
- `count`: Number of deals in this stage
- `total_amount_cents`: Sum of all deal amounts in this stage
- `deals`: Array of deal objects with joined contact names

### Best Practices for Pipeline Management

**Daily pipeline review:**

1. Open the Pipeline page first thing in the morning
2. Check for any deals with overdue expected close dates (shown in red)
3. Move deals that have progressed to their next stage
4. Review any new auto-created deals from yesterday's calls

**Weekly pipeline cleanup:**

1. Archive deals that are no longer relevant
2. Update expected close dates for stalled deals
3. Review win/loss ratio for the week
4. Create follow-up tasks for deals stuck in the same stage

---

## 11. Task Management

### What Are Tasks?

Tasks are actionable items that track follow-ups, callbacks, reminders, and other work linked to contacts and deals. Tasks can be created manually or generated automatically by the post-call automation system.

### Navigating to Tasks

Select **Tasks** from the sidebar navigation. The tasks page displays a data table with summary counts at the top.

### Task Summary Counts

The page header shows four real-time metrics retrieved from `GET /api/tasks/counts`:

- **Pending:** Number of tasks not yet completed (done_at is null)
- **Overdue:** Number of past-due tasks (done_at is null AND due_date is before today). Highlighted in red if greater than zero.
- **Due Today:** Number of tasks due today (done_at is null AND due_date equals today)
- **Done This Week:** Number of tasks completed in the current week (done_at is not null AND done_at is after the start of the current week). Highlighted in green.

### Task List View

| Column       | Description                        |
| ------------ | ---------------------------------- |
| **Checkbox** | Click to mark done                 |
| **Title**    | Task title (strikethrough if done) |
| **Type**     | Type badge (Follow Up, Call Back)  |
| **Contact**  | Linked contact name or dash        |
| **Due Date** | Relative date with overdue in red  |
| **Priority** | Badge: Urgent, High, Medium, Low   |
| **Source**   | Manual, Voice Call, AI Agent       |

### Filtering Tasks

**Status Tabs:**

- **All** -- Show all tasks
- **Pending** -- Uncompleted tasks (done_at IS NULL)
- **Overdue** -- Past-due uncompleted tasks
- **Done** -- Completed tasks (done_at IS NOT NULL)

**Type Filter (dropdown):**

_Universal types (all industries):_

| Type        | Label     |
| ----------- | --------- |
| `follow_up` | Follow Up |
| `call_back` | Call Back |
| `email`     | Email     |
| `meeting`   | Meeting   |
| `review`    | Review    |
| `custom`    | Custom    |

_Industry-specific types:_

| Industry     | Additional Types                  |
| ------------ | --------------------------------- |
| Medical      | Insurance Verification, Rx Refill |
| Dental       | Insurance Verification            |
| Restaurant   | Vendor Order, Event Setup         |
| Auto Service | Parts Order, Vehicle Pickup       |

**Priority Filter (dropdown):**

- All Priorities / Urgent (red) / High (orange) / Medium (amber) / Low (blue)

### Sorting Tasks

Click the **Title** or **Due Date** column header to sort. By default, tasks are sorted by due date ascending (most urgent first). The API supports sorting by: created_at, updated_at, title, type, priority, due_date, due_time, done_at, source.

### Creating a Task

1. Click the **Add Task** button in the top-right corner.
2. Fill in the task form:
   - **Title** (required): A clear description of the task.
   - **Type** (required, default: Follow Up): Select from the type dropdown.
   - **Priority** (required, default: Medium): Urgent, High, Medium, or Low.
   - **Due Date** (required, default: tomorrow): When the task should be completed.
   - **Due Time** (optional): Specific time of day for the task.
   - **Description** (optional): Additional context.
   - **Contact** (optional): Link to a contact by providing their ID.
   - **Deal** (optional): Link to a deal by providing its ID.
   - **Assigned To** (optional): User ID or name of the responsible person.
3. Click **Add Task** to save.

### Completing a Task

Click the checkbox next to a task to mark it as done. The completion happens optimistically -- the UI updates immediately, and if the server update fails, the change is reverted.

Completed tasks show:

- A green checkmark icon replacing the empty checkbox
- Strikethrough text on the title
- Grayed-out priority badge
- "Done" in place of the due date

The completion sets `done_at` to the current timestamp. There is no "undo" in the UI, but the task can be reopened by setting `done_at` back to null via the API.

### Deleting a Task

Tasks are hard-deleted (permanently removed from the database), unlike contacts and deals which use soft deletion. This is done via `DELETE /api/tasks/:id`.

### Viewing Upcoming and Overdue Tasks

The API provides two specialized views:

- **Upcoming tasks:** Tasks due within the next N days (default: 7 days). Accessible via `GET /api/tasks/upcoming?days=7`. Returns tasks sorted by due_date ascending, then due_time ascending (nulls last).
- **Overdue tasks:** All past-due uncompleted tasks. Accessible via `GET /api/tasks/overdue`. Returns tasks sorted by due_date ascending (oldest overdue first).

### Linking Tasks to Deals

Tasks can be linked to deals via the `deal_id` field. This is useful for tracking specific actions required to move a deal forward. For example:

- "Send proposal to client" linked to a deal at the "Proposal" stage
- "Verify insurance" linked to a medical case at the "Scheduled" stage
- "Order parts" linked to an auto service order at the "Scheduled" stage

To view all tasks for a specific deal, use `GET /api/tasks?deal_id={deal_id}`.

---

## 12. Task Automation and Workflows

### How Tasks Are Auto-Created

The post-call automation engine creates tasks automatically based on call outcomes. These automated tasks reduce the risk of missed follow-ups and ensure that important actions are tracked even when staff are busy.

### Automated Task Rules

**Rule 1: Escalation Follow-Up**

- **Trigger:** Call outcome is "escalation"
- **Task Created:**
  - Title: "Follow up: escalated call from [Name]"
  - Type: `call_back`
  - Priority: `high`
  - Due Date: tomorrow
  - Source: `auto`

**Rule 2: Missed/Short Call Callback**

- **Trigger:** Call status "missed" OR duration < 10 seconds
- **Task Created:**
  - Title: "Missed call from [Name]"
  - Type: `call_back`
  - Priority: `high`
  - Due Date: today
  - Source: `auto`

### Task Lifecycle Workflow

The recommended workflow for managing tasks:

1. **Morning Review:** Open the Tasks page and check the Overdue count. Address overdue tasks first.
2. **Daily Execution:** Work through tasks sorted by due date. Complete each task by clicking the checkbox.
3. **End of Day:** Check the "Due Today" count. Any remaining tasks should be completed or rescheduled.
4. **Weekly Review:** Check "Done This Week" to measure productivity. Review upcoming tasks for the next week.

### Task Priority Guidelines

| Priority | When to Use                      |
| -------- | -------------------------------- |
| Urgent   | Time-sensitive, must be done now |
| High     | Important, should be done today  |
| Medium   | Normal priority, this week       |
| Low      | Nice to have, no firm deadline   |

### Escalation Rules for Overdue Tasks

While the system does not currently auto-escalate overdue tasks, the following manual process is recommended:

1. Filter tasks by status = "overdue" daily
2. For tasks overdue by 3+ days, escalate to a manager
3. For tasks overdue by 7+ days, evaluate relevance
4. Delete irrelevant tasks; reassign remaining ones

---

## 13. Call History

### Navigating to Call History

Select **Calls** from the sidebar navigation. The call history page displays a comprehensive log of all calls handled by the voice agent.

### Call List View

| Column        | Description                        |
| ------------- | ---------------------------------- |
| **Direction** | Inbound (green) or outbound (blue) |
| **Caller**    | Name and phone number              |
| **Outcome**   | Badge showing the call result      |
| **Flow**      | Visual timeline bar                |
| **Duration**  | Call length in MM:SS format        |
| **When**      | Relative timestamp                 |

### Searching Calls

Use the search bar to find calls by caller name or phone number. The search applies a 300ms debounce and matches using ILIKE pattern matching against both `caller_phone` and `caller_name` fields.

### Filtering by Outcome

Use the **outcome dropdown** to filter calls by result:

- All Outcomes
- Booking (or your industry's transaction label)
- Inquiry
- Support
- Escalated
- Hangup

Additional filters available via the API:

- **status** -- ringing, connected, completed, failed, missed
- **start_date** / **end_date** -- date range filtering
- **limit** -- maximum 100 records per page
- **offset** -- pagination offset

### Call Detail Panel

Click any call row to open the detail panel on the right side of the screen. The detail view includes:

**Caller Information:**

- Caller name and phone number (with copy-to-clipboard)

**Metadata Grid:**

- **Duration:** Formatted as "Xm Ys"
- **Date:** Full date and time
- **Outcome:** Badge with outcome type
- **Direction:** Inbound or outbound badge

**Summary:**

The AI-generated summary of the call, describing what the caller wanted and what happened.

**Detected Intents:**

Tags showing what the caller intended (e.g., "booking", "hours_inquiry", "pricing").

**Linked Contact:**

If the call is linked to a contact, their name, email, and phone are shown in a card.

**Linked Booking:**

If the call resulted in a booking, the booking details are shown: type, status, date, time, and confirmation code.

**Recording:**

If a recording is available, an audio player is embedded for playback.

**Transcript:**

The full conversation transcript, displayed as a chat-style view with alternating bubbles for the AI Agent and the Caller. The transcript supports multiple formats:

- Structured JSON array with `role` and `content` fields
- String format with "AI:" and "User:" prefixes
- Wrapped object with `messages` or `transcript` keys

### Call Outcomes

| Outcome      | Meaning                           |
| ------------ | --------------------------------- |
| `booking`    | Successfully made a booking       |
| `inquiry`    | Asked questions, did not book     |
| `support`    | Needed help with existing booking |
| `escalation` | Escalated to a human agent        |
| `hangup`     | Hung up before completing         |

### Call Statuses

| Status      | Meaning                           |
| ----------- | --------------------------------- |
| `ringing`   | Call is ringing, not yet answered |
| `connected` | Call is in progress               |
| `completed` | Call ended normally               |
| `failed`    | Call failed to connect            |
| `missed`    | Call was not answered             |

### Sentiment Score Interpretation

| Score Range  | Meaning         | Action                         |
| ------------ | --------------- | ------------------------------ |
| +0.6 to +1.0 | Very positive   | Note for upsell opportunity    |
| +0.1 to +0.5 | Mildly positive | Standard follow-up             |
| -0.1 to +0.1 | Neutral         | No special action needed       |
| -0.5 to -0.2 | Mildly negative | Review transcript carefully    |
| -1.0 to -0.6 | Very negative   | Escalate, create callback task |

---

## 14. Call Analytics and Reporting

### Navigating to Analytics

Select **Analytics** from the sidebar navigation. The analytics page provides visual insights into call performance and booking conversion.

### Time Period Selection

Use the dropdown in the top-right corner to select the analysis period:

- Last 7 days
- Last 14 days
- Last 30 days (default)
- Last 90 days

Click **Refresh** to reload the data.

### Summary Statistics

Four stat cards appear at the top of the page:

| Metric                | Description                      |
| --------------------- | -------------------------------- |
| **Total Calls**       | Calls in the selected period     |
| **Bookings Made**     | Calls that converted to bookings |
| **Conversion Rate**   | Percentage of calls to bookings  |
| **Avg Call Duration** | Average length in MM:SS          |

### Charts

**Call Volume (Area Chart):**

Daily call count plotted over time as a filled area chart. Shows trends in call volume and helps identify busy periods. Each data point represents a single day.

**Call Outcomes (Pie Chart):**

A donut chart showing the distribution of call outcomes:

- Booking: green
- Inquiry: blue
- Support: amber
- Escalation: red
- Hangup: gray

**Calls vs Bookings (Bar Chart):**

A grouped bar chart comparing daily call volume (indigo) against daily bookings (green). Helps visualize conversion trends over time.

**Peak Call Hours (Horizontal Bar Chart):**

Shows the top 5 busiest hours of the day based on call volume. Useful for staffing decisions and understanding when customers are most likely to call. The hours are determined by grouping all calls in the period by their hour of creation (0-23) and sorting by count descending, returning only the top 5.

### Period Comparison

Below the charts, a comparison section shows three metrics across three time frames (today, this week, this month):

- **Calls:** Today / This Week / This Month
- **Bookings:** Today / This Week / This Month
- **Estimated Revenue:** Today / This Week / This Month

### Call Duration Metrics

The API provides average call duration based on the last 100 completed calls via `GET /api/calls/stats`. This rolling average smooths out outliers and gives a representative picture of typical call length.

### Time Series Data

The analytics API (`GET /api/calls/analytics?days=30`) returns:

- **period:** The date range and number of days
- **summary:** Aggregated totals
  - totalCalls, totalBookings
  - conversionRate (rounded to 1 decimal)
  - avgDurationSeconds
- **timeSeries:** Daily breakdown (date, calls, bookings, avgDuration)
- **outcomes:** Outcome distribution as name/value pairs
- **peakHours:** Top 5 busiest hours with hour number and call count

---

## 15. Activity Tracking

### Contact Activity Log

Every contact has an activity timeline that records all interactions in chronological order. View it in the **Activity** tab of the contact detail drawer.

### Activity Types

The system tracks 19 distinct activity types:

| Activity Type       | Description                     |
| ------------------- | ------------------------------- |
| `call_received`     | Inbound call from contact       |
| `call_made`         | Outbound call to contact        |
| `booking_created`   | New booking made                |
| `booking_modified`  | Booking was changed             |
| `booking_cancelled` | Booking was cancelled           |
| `booking_completed` | Booking was completed           |
| `booking_no_show`   | Contact did not show up         |
| `sms_sent`          | SMS sent to contact             |
| `sms_received`      | SMS received from contact       |
| `email_sent`        | Email sent to contact           |
| `email_opened`      | Contact opened an email         |
| `email_clicked`     | Contact clicked email link      |
| `note_added`        | Note was added                  |
| `tag_added`         | Tag was added                   |
| `tag_removed`       | Tag was removed                 |
| `status_changed`    | Status was changed              |
| `merged`            | Contact was merged              |
| `imported`          | Contact was imported or created |
| `exported`          | Contact data was exported       |

### Activity Entry Details

Each activity entry contains:

- **activity_type:** The type identifier from the table above
- **description:** Human-readable text (e.g., "Status changed from active to vip")
- **created_at:** Timestamp of the activity
- **metadata:** Additional context as JSON (e.g., `{ "old_status": "active", "new_status": "vip" }`)
- **related_id:** ID of the related record (call, booking, note)
- **related_type:** Type of the related record
- **performed_by:** User or system identifier

### How Activities Are Generated

Activities are generated automatically by the contact service layer. Every significant operation on a contact triggers an `addActivity` call:

- Creating a contact logs an `imported` activity
- Updating contact status logs a `status_changed` activity
- Soft-deleting a contact logs a `status_changed` activity (to inactive)
- Adding a note logs a `note_added` activity
- Adding a tag logs a `tag_added` activity
- Removing a tag logs a `tag_removed` activity
- Merging contacts logs a `merged` activity on the primary

### Viewing Activity History via API

```
GET /api/contacts/:id/history?limit=50&offset=0
```

Returns a paginated list of activities sorted by created_at descending (most recent first).

---

## 16. Post-Call Automation Engine

### Overview

The post-call automation engine runs after every call is logged. It is a non-blocking process -- the automation is called with `.catch()` error handling so it never blocks the call log API response. If any rule fails, the error is logged but the system continues operating normally.

### Automation Context

When the automation runs, it receives the following context:

- `tenantId` -- The tenant that owns this call
- `callId` -- The ID of the call that just completed
- `contactId` -- The ID of the linked contact (if any)
- `callerPhone` -- The caller's phone number
- `callerName` -- The caller's name (if identified)
- `outcomeType` -- The call outcome
- `durationSeconds` -- How long the call lasted
- `status` -- The call status
- `industry` -- The tenant's industry configuration

If no contact is linked (contactId is null), the automation exits immediately.

### Rule 1: Booking Outcome

**Trigger:** `outcomeType === "booking"`

**Actions:**

1. Creates a deal at the industry's completed stage
   - Name: "[Contact Name] - [Deal Label]"
   - Stage: completedStage (e.g., "won", "completed")
   - Source: "call"
   - Linked to the contact and call
2. Updates lead_status to "converted"

**Early Return:** After this rule fires, no further rules run.

### Rule 2: Escalation Outcome

**Trigger:** `outcomeType === "escalation"`

**Actions:**

1. Creates a follow-up task
   - Title: "Follow up: escalated call from [Name]"
   - Type: `call_back`, Priority: `high`
   - Due Date: tomorrow
   - Source: "auto"

**Early Return:** After this rule fires, no further rules run.

### Rule 3: Missed or Very Short Call

**Trigger:** `status === "missed"` OR `durationSeconds < 10`

**Actions:**

1. Creates a callback task
   - Title: "Missed call from [Name]"
   - Type: `call_back`, Priority: `high`
   - Due Date: today (same day)
   - Source: "auto"

**Early Return:** After this rule fires, no further rules run.

### Rule 4: VIP Upgrade

**Trigger:** All must be true:

- Contact has 3+ total calls
- Engagement score is 80+
- Current status is not "vip"

**Actions:**

1. Updates contact status to "vip"

**No Early Return:** This rule can fire alongside Rule 5.

### Rule 5: First-Time Inquiry

**Trigger:** All must be true:

- Contact has 1 or fewer total calls
- Call outcome is "inquiry"

**Actions:**

1. Creates a deal at the industry's default stage
   - Name: "[Contact Name] - New [Deal Label]"
   - Stage: defaultStage (e.g., "new", "inquiry")
   - Source: "call"
2. Confirms lead_status as "new"

### Rule Execution Order

Rules are evaluated in order (1 through 5). Rules 1, 2, and 3 use early returns, meaning only one of these will fire per call. Rules 4 and 5 can both fire if their conditions are met.

### Error Handling

If any rule throws an error, the error is caught and logged to the console with the prefix `[AUTOMATION]`. The remaining rules are not executed for that call.

---

## 17. Contact Segmentation and Filtering

### Advanced Search Capabilities

The contact search system supports a wide range of filters that can be combined to create precise segments of your customer base.

### Available Filter Parameters

**Text Search:**

- `search` -- Matches against name, email, and phone using ILIKE. Supports partial matches.

**Status Filters:**

- `status` -- active, inactive, blocked, vip, churned. Comma-separated for multiple.
- `lead_status` -- new, contacted, qualified, converted, lost. Comma-separated.

**Source Filters:**

- `source` -- call, booking, import, manual, sms, web. Comma-separated.

**Tag Filters:**

- `tags` -- Comma-separated. Uses array overlap matching (contact matches if they have ANY specified tag).

**Behavioral Filters:**

- `has_bookings` -- true/false
- `has_calls` -- true/false

**Date Range Filters:**

- `created_after` -- ISO 8601 date
- `created_before` -- ISO 8601 date
- `last_contact_after` -- ISO 8601 date
- `last_contact_before` -- ISO 8601 date

### Segmentation Examples

**High-Value Active Customers:**

```
GET /api/contacts?status=vip,active&has_bookings=true
```

**New Leads from This Month:**

```
GET /api/contacts?lead_status=new&created_after=2026-03-01
```

**Dormant Contacts (No Activity in 60 Days):**

```
GET /api/contacts?last_contact_before=2025-12-31
```

**Contacts from Phone Calls Who Never Booked:**

```
GET /api/contacts?source=call&has_bookings=false
```

### Sorting Options

Results can be sorted by any of these fields:

- `name` (alphabetical)
- `created_at` (newest or oldest first)
- `last_contact_at` (most or least recent)
- `engagement_score` (highest or lowest first)
- `total_calls` (most or fewest)
- `total_bookings` (most or fewest)
- `lifetime_value_cents` (highest or lowest)

Default sort: `last_contact_at` descending.

### Pagination

All search results are paginated. The response includes:

- `data` -- Array of contact records
- `total` -- Total number of matching contacts
- `limit` -- Records per page (default 20, max 100)
- `offset` -- Current offset
- `has_more` -- Boolean indicating if more records exist

---

## 18. Search and Global Lookup

### Fast Phone Lookup

The system provides a dedicated fast-path endpoint for phone-based lookup, optimized for the voice agent:

```
GET /api/contacts/lookup?phone=+15551234567
```

This endpoint uses the in-memory tenant cache for sub-50ms responses. It returns `{ found: true, contact: {...} }` or `{ found: false, contact: null }`.

### Email Lookup

```
GET /api/contacts/lookup/email?email=jane@example.com
```

Returns the same structure as phone lookup but queries by email address.

### Find or Create

The voice agent uses this endpoint to ensure a contact exists before proceeding with a call:

```
POST /api/contacts/find-or-create
```

Body: `{ "phone": "+15551234567", "name": "Jane Doe" }`

This endpoint:

1. Normalizes the phone number to E.164 format
2. Checks the cache for an existing contact
3. Falls back to a database query if not cached
4. Creates a new contact if none exists (source: "call")
5. Returns the full contact record

### Search Performance Characteristics

| Operation             | Typical Latency | Notes                       |
| --------------------- | --------------- | --------------------------- |
| Phone lookup (cached) | < 50ms          | In-memory Map lookup        |
| Phone lookup (DB)     | 100-200ms       | Database query              |
| Text search (ILIKE)   | 200-500ms       | Depends on dataset size     |
| Filtered search       | 200-800ms       | More filters = more clauses |
| Export (all contacts) | 1-5 seconds     | Limited to 100,000 records  |

---

## 19. Bulk Operations

### Bulk Tagging

Add a tag to multiple contacts simultaneously:

```
POST /api/contacts/bulk/tags
{
  "contact_ids": ["uuid1", "uuid2", "uuid3"],
  "tag": "campaign-2026-q1"
}
```

The response returns the count of contacts updated. Uses an optimized database function (`bulk_add_tag`) for efficient batch processing.

### Bulk Import

Import up to 10,000 contacts in a single operation:

```
POST /api/contacts/import
{
  "records": [
    { "phone": "+15551234567", "name": "John" },
    { "phone": "+15559876543", "name": "Jane" }
  ],
  "skip_duplicates": true,
  "update_existing": false
}
```

See Section 24 for full import documentation.

### Bulk Export

Export contacts matching any filter combination:

```
POST /api/contacts/export
{
  "format": "csv",
  "filters": { "status": "active", "has_bookings": true }
}
```

Supports JSON and CSV formats.

### Contact Merging

```
POST /api/contacts/merge
{
  "primary_id": "uuid-of-primary",
  "secondary_ids": ["uuid-dup-1", "uuid-dup-2"]
}
```

See Section 3 under "Merging Duplicate Contacts" for full details.

### Data Cleanup Recommendations

**Finding Duplicates:**

1. Export all contacts to CSV
2. Sort by phone number to identify duplicates
3. Review contacts with similar names but different phones
4. Use the merge API to consolidate duplicates

**Cleaning Inactive Records:**

1. Filter contacts with status "inactive" and no calls in the last 180 days
2. Review each contact to confirm they are truly inactive
3. Consider permanently deleting if no useful data exists
4. Alternatively, add a "cleanup-candidate" tag for later review

**Standardizing Tags:**

1. Export contacts and review unique tag values
2. Identify inconsistencies (e.g., "VIP" vs "vip" vs "V.I.P.")
3. Use the tag add/remove API to standardize
4. Document the approved tag taxonomy for your team

---

## 20. CRM Dashboard Widgets

### Call Statistics Widget

Displays key call metrics:

- **Calls Today:** Number of calls received today
- **Calls This Week:** Cumulative weekly call count
- **Calls This Month:** Cumulative monthly call count
- **Avg Duration:** Average call duration (last 100 calls)

Data source: `GET /api/calls/stats`

### Recent Calls Widget

Shows the most recent calls in a compact list format with caller name, phone number, duration, outcome badge, summary (truncated), and timestamp.

Displays up to 10 recent calls. Data source: `GET /api/calls/recent?limit=10`

### Task Counts Widget

Displays four task metrics in colored cards:

- **Pending** -- Total uncompleted tasks
- **Overdue** -- Past-due tasks (red highlight)
- **Due Today** -- Tasks due today
- **Done This Week** -- Completed this week (green highlight)

Data source: `GET /api/tasks/counts`

### Pipeline Summary Widget

Shows the deal pipeline at a glance: total active deals, total pipeline value, deal count per stage, value per stage.

Data source: `GET /api/deals/pipeline`

### Outcome Distribution Widget

A summary of call outcomes for the current period: booking, inquiry, support, escalation, and hangup counts with percentages.

Data source: Derived from `GET /api/calls/analytics`

---

## 21. Integration with Voice Agent

### How Calls Feed into the CRM

The voice agent (built on LiveKit Agents with Python) communicates with the CRM API through internal HTTP endpoints.

**Step 1: Contact Resolution**

The agent sends `POST /api/contacts/find-or-create` with the caller's phone number. The API normalizes the number, checks cache (<50ms), then database, and creates if needed.

**Step 2: Call Processing**

The voice agent builds a system prompt including the contact's history, then conducts the conversation using STT (Deepgram nova-3) + LLM (GPT-4.1-mini) + TTS (Cartesia Sonic-3).

**Step 3: Call Logging**

When the call ends, the agent logs via internal API with: direction, caller info, duration, status, outcome, summary, sentiment, intents, transcript, and linked IDs.

**Step 4: Post-Call Automation**

After logging, the API triggers the post-call automation engine asynchronously.

### Voice Agent Configuration Impact on CRM

- **Agent personality** affects sentiment scores
- **Call duration limits** affect duration metrics
- **Escalation config** affects escalation outcome ratio
- **Booking tool availability** affects conversion rates

### Data Latency

| Operation               | Typical Latency |
| ----------------------- | --------------- |
| Contact lookup          | < 50ms (cached) |
| Call logging            | < 500ms         |
| Post-call automation    | 1-3 seconds     |
| Engagement score update | 1-5 seconds     |
| Notification queuing    | 1-2 seconds     |

---

## 22. Notification System

### Notification Queue

The **Queue** tab displays all notifications with columns:

| Column        | Description                      |
| ------------- | -------------------------------- |
| **Status**    | Clock, spinner, check, or X icon |
| **Channel**   | Envelope (email) or bubble (SMS) |
| **Type**      | "Booking Confirmation", etc.     |
| **Recipient** | Name and contact info            |
| **Message**   | Preview (truncated)              |
| **Created**   | When created                     |
| **Sent**      | When sent                        |

**Status Filter Buttons:** All, Pending, Sent, Failed

### Notification Types

| Type                   | Description                  |
| ---------------------- | ---------------------------- |
| `booking_confirmation` | Sent when booking is created |
| `booking_reminder_24h` | Sent 24 hours before         |
| `booking_reminder_1h`  | Sent 1 hour before           |
| `booking_modified`     | Sent when booking changes    |
| `booking_cancelled`    | Sent when booking cancelled  |
| `booking_rescheduled`  | Sent when rescheduled        |
| `missed_call_followup` | Sent after missed call       |
| `thank_you`            | After completed booking      |
| `review_request`       | Request for review           |
| `marketing`            | Marketing (requires opt-in)  |
| `custom`               | Custom one-off messages      |

### Notification Lifecycle

```
pending --> queued --> sending --> sent --> delivered
                        |
                      failed --> (retry) --> sent
```

| Status      | Description               |
| ----------- | ------------------------- |
| `pending`   | Created, not yet queued   |
| `queued`    | In the delivery queue     |
| `sending`   | Currently being sent      |
| `sent`      | Sent to provider          |
| `delivered` | Confirmed delivered       |
| `opened`    | Recipient opened (email)  |
| `clicked`   | Recipient clicked link    |
| `bounced`   | Delivery bounced          |
| `failed`    | Failed (retries up to 3x) |
| `cancelled` | Cancelled before sending  |

### Notification Templates

**Default Templates:**

1. **Booking Confirmation SMS:** "Hi {{customer_name}}, your {{booking_type}} is confirmed for {{booking_date}} at {{booking_time}}. Confirmation: {{confirmation_code}}."
2. **Booking Confirmation Email:** Full HTML email with booking details.
3. **Booking Reminder 24h SMS:** "Reminder: Your {{booking_type}} is tomorrow at {{booking_time}}..."
4. **Booking Reminder 1h SMS:** "Reminder: Your {{booking_type}} is in 1 hour..."
5. **Booking Cancellation SMS:** "Your {{booking_type}} for {{booking_date}} at {{booking_time}} has been cancelled..."
6. **Missed Call Follow-up SMS:** "Hi! We missed your call. How can we help?..."

**Template Variables:**

- `customer_name`, `booking_type`, `booking_date`
- `booking_time`, `confirmation_code`, `business_name`

### Notification Preferences

The **Settings** tab configures per-tenant notification preferences:

- Enable/disable email notifications per type
- Enable/disable SMS notifications per type
- Configure reminder timing
- Enable/disable review requests

Preferences are stored in `notification_preferences` with upsert semantics keyed on `tenant_id` + `notification_type`.

### Retry Logic

Failed notifications retry up to 3 times (`max_retries` field). Each retry uses the `next_retry_at` timestamp. After all retries are exhausted, the notification remains in "failed" status for manual review.

### Sending a Notification via API

```
POST /api/notifications/send
{
  "channel": "sms",
  "notification_type": "custom",
  "recipient": "+15551234567",
  "recipient_name": "John Smith",
  "body": "Your appointment is confirmed."
}
```

### Previewing a Template

```
POST /api/notifications/preview
{
  "notification_type": "booking_confirmation",
  "channel": "sms",
  "variables": {
    "customer_name": "Jane Doe",
    "booking_type": "Haircut",
    "booking_date": "March 15",
    "booking_time": "2:00 PM",
    "confirmation_code": "ABC123"
  }
}
```

---

## 23. Escalation Management

### How Escalation Works

The voice agent includes a smart escalation manager that handles caller requests to speak with a human. The system demonstrates the AI's capabilities before escalating, while respecting the caller's autonomy.

### Immediate Escalation Triggers

The following keywords cause immediate escalation:

| Category    | Keywords                            |
| ----------- | ----------------------------------- |
| Complaints  | "complaint", "refund", "money back" |
| Emergencies | "emergency", "urgent", "crisis"     |
| Authority   | "manager", "supervisor", "owner"    |
| Serious     | "harassment", "discrimination"      |
| Legal       | "lawyer", "lawsuit", "sue"          |
| Account     | "cancel all", "close account"       |
| Authorities | "police", "authorities"             |

### Graduated Deflection Flow

| Request Number   | System Behavior          |
| ---------------- | ------------------------ |
| **1st request**  | Soft deflection          |
| **2nd request**  | Escalate if valid reason |
| **3rd request**  | Escalate if valid reason |
| **4th+ request** | Always escalate          |

### AI Failure Escalation

The system also escalates when:

- **3+ consecutive AI failures**
- **10+ turns without resolution**

### Call Outcome for Escalations

Escalation outcome triggers: a high-priority `call_back` task due tomorrow, linked to the contact and call.

---

## 24. Data Import and Export

### Importing Contacts

**Import Format:**

Each record must include a `phone` field:

| Field           | Type            | Required |
| --------------- | --------------- | -------- |
| `phone`         | String          | Yes      |
| `email`         | String          | No       |
| `name`          | String          | No       |
| `first_name`    | String          | No       |
| `last_name`     | String          | No       |
| `company`       | String          | No       |
| `tags`          | String or Array | No       |
| `notes`         | String          | No       |
| `custom_fields` | Object          | No       |

When tags are provided as a string, they are split by comma and trimmed.

**Import Options:**

| Option            | Default | Description                 |
| ----------------- | ------- | --------------------------- |
| `skip_duplicates` | false   | Skip existing phone numbers |
| `update_existing` | false   | Update existing records     |

Maximum 10,000 records per import.

**Import Results:**

- `total`: Records processed
- `created`: New contacts created
- `updated`: Existing contacts updated
- `skipped`: Duplicates skipped
- `errors`: Array with row number, field, message

### Exporting Contacts

**Export Formats:**

| Format | Description            |
| ------ | ---------------------- |
| JSON   | Full contact records   |
| CSV    | Spreadsheet-compatible |

**CSV Export Columns:**

id, phone, email, name, first_name, last_name, company, status, lead_status, tags, total_calls, total_bookings, lifetime_value_cents, created_at

Exports respect active filters. Up to 100,000 records.

### Import Best Practices

1. Validate phone numbers before importing
2. Use skip_duplicates on first import
3. Use update_existing for subsequent imports
4. Break large files into 5,000-10,000 batches
5. Include tags for immediate segmentation
6. Review the error report after every import

---

## 25. Data Privacy and GDPR Compliance

### Communication Preference Flags

Every contact has four compliance flags:

- `do_not_call` -- Suppresses outbound phone calls
- `do_not_sms` -- Suppresses SMS notifications
- `do_not_email` -- Suppresses email notifications
- `marketing_opt_in` -- Required for marketing messages

### Marketing Opt-In Tracking

When `marketing_opt_in` is set to true, the system records the timestamp in `marketing_opt_in_at`. This provides an auditable record. The timestamp is not cleared if opt-in is revoked.

### Soft Deletion

Contacts are never permanently deleted through the standard API. The delete operation sets status to "inactive", preserving all associated data for audit trails, historical analytics, and regulatory requirements.

### Data Export for Subject Access Requests

To fulfill a DSAR:

1. Search for the contact by phone or email
2. Export complete contact record (JSON)
3. Export call history via `GET /api/contacts/:id/calls`
4. Export booking history via `GET /api/contacts/:id/bookings`
5. Export notes via `GET /api/contacts/:id/notes`
6. Export activity history via `GET /api/contacts/:id/history`

### Data Minimization

The CRM only collects directly relevant data: phone number, name, email, call transcripts, and booking details.

### Audit Logging

Sensitive operations are logged with: action, resource type/ID, old/new values, user ID, IP address, and user agent.

### Retention Considerations

Business owners should establish retention policies using:

- last_contact_before filters to identify inactive contacts
- Export before cleanup
- Soft-delete for contacts no longer needed
- Audit log review for compliance reporting

---

## 26. Multi-Tenant Data Isolation

### Architecture Overview

Lumentra uses a shared-database, tenant-isolated architecture. All tenants share the same PostgreSQL database, but every table includes a `tenant_id` column. Data isolation is enforced at three levels.

### Database Level (RLS)

PostgreSQL Row-Level Security policies ensure queries only return rows matching the authenticated tenant. Even direct SQL queries through administrative tools are subject to RLS when the session role is set correctly.

### Application Level

Every API route extracts the tenant ID from the authenticated session via `getAuthTenantId(c)` and includes it as a WHERE clause parameter. This defense-in-depth approach means data is protected even if RLS is misconfigured.

### Cache Level

The tenant cache (`tenant-cache.ts`) keys entries by both phone number and tenant ID (`id:{tenantId}`). The cache uses a Map data structure with O(1) lookup time. It refreshes every 5 minutes from the database and supports manual invalidation via `invalidateTenant(tenantId)`.

**Cache key patterns:**

| Key Pattern    | Purpose             |
| -------------- | ------------------- |
| `+15551234567` | Phone number lookup |
| `id:{uuid}`    | Tenant ID lookup    |
| `sip:{uri}`    | SIP URI lookup      |

### What Happens If a Tenant Is Deactivated

When `is_active` is set to false on a tenant record:

- The tenant is excluded from the next cache refresh
- Phone lookups for that tenant's number return null
- API requests with that tenant's ID fail authentication
- Existing data remains in the database but is inaccessible

---

## 27. Industry-Specific CRM Workflows

### Hotel and Motel Workflow

**Typical Call Flow:**

1. Guest calls about room availability
2. Voice agent checks availability and quotes rates
3. If guest books, a reservation is created
4. CRM creates a "Booking" deal at "Reserved" stage
5. Confirmation notification sent via SMS

**Pipeline:** Inquiry -> Reserved -> Checked In -> Checked Out (or Cancelled/No-Show)

**Tags:** "returning-guest", "corporate", "group-booking", "loyalty-member"

**Key Metrics:** Average booking value, no-show rate, repeat guest percentage

### Restaurant Workflow

**Typical Call Flow:**

1. Diner calls to make a reservation
2. Voice agent checks table availability
3. Reservation is created with party size
4. CRM creates a "Reservation" deal at "Reserved" stage

**Pipeline:** Inquiry -> Reserved -> Confirmed -> Seated -> Completed (or Cancelled/No-Show)

**Tags:** "large-party", "private-event", "dietary-restrictions", "regular"

**Additional Task Types:** Vendor Order, Event Setup

### Medical Practice Workflow

**Typical Call Flow:**

1. Patient calls to schedule an appointment
2. Voice agent verifies patient information
3. Agent checks provider availability
4. Appointment is created
5. CRM creates a "Case" deal at "Scheduled" stage

**Pipeline:** Inquiry -> Scheduled -> Confirmed -> Completed (or Cancelled/No-Show)

**Tags:** "new-patient", "insurance-verified", "referral", "follow-up-needed"

**Additional Task Types:** Insurance Verification, Prescription Refill

### Dental Practice Workflow

Similar to medical, with Insurance Verification as a task type. Additional tags: "cleaning-due", "treatment-plan-pending", "orthodontics".

### Salon and Spa Workflow

**Typical Call Flow:**

1. Client calls to book a service
2. Voice agent checks stylist/therapist availability
3. Appointment is created
4. CRM creates an "Appointment" deal at "Booked" stage

**Pipeline:** Inquiry -> Booked -> Confirmed -> Completed (or Cancelled/No-Show)

**Tags:** "color-client", "bridal-party", "membership", "first-visit"

### Auto Service Workflow

**Typical Call Flow:**

1. Customer calls about vehicle service
2. Voice agent collects vehicle info
3. Agent provides a quote if possible
4. Service appointment is scheduled
5. CRM creates a "Service Order" deal

**Pipeline:** Inquiry -> Quoted -> Scheduled -> In Progress -> Completed (or Cancelled)

**Tags:** "fleet-account", "warranty", "collision-repair", "maintenance-plan"

**Additional Task Types:** Parts Order, Vehicle Pickup

---

## 28. Advanced Reporting and KPIs

### Key Performance Indicators

**Call Performance KPIs:**

| KPI               | Source                     | Formula                |
| ----------------- | -------------------------- | ---------------------- |
| Total Call Volume | `GET /api/calls/stats`     | Direct count           |
| Avg Call Duration | `GET /api/calls/stats`     | Mean of last 100 calls |
| Conversion Rate   | `GET /api/calls/analytics` | bookings / total calls |
| Escalation Rate   | Analytics outcomes         | escalations / total    |
| Hangup Rate       | Analytics outcomes         | hangups / total        |

**Customer Engagement KPIs:**

| KPI              | Source       | Formula              |
| ---------------- | ------------ | -------------------- |
| New Contacts     | Contacts API | created_after filter |
| VIP Count        | Contacts API | status=vip filter    |
| Avg Engagement   | Contacts API | Mean of all scores   |
| Engagement Dist. | Contacts API | Count per level      |

**Pipeline KPIs:**

| KPI                  | Source       | Formula                 |
| -------------------- | ------------ | ----------------------- |
| Total Pipeline Value | Pipeline API | Sum of amount_cents     |
| Average Deal Size    | Pipeline API | Mean deal amount        |
| Win Rate             | Deals API    | completed / total       |
| Stage Conversion     | Deals API    | moved / total per stage |

**Task Performance KPIs:**

| KPI               | Source                   | Formula                |
| ----------------- | ------------------------ | ---------------------- |
| Completion Rate   | `GET /api/tasks/counts`  | done / total           |
| Overdue Count     | `GET /api/tasks/overdue` | Direct count           |
| Avg Tasks/Contact | Tasks + Contacts         | total tasks / contacts |

### Building Custom Reports

1. Use `GET /api/calls/analytics?days=N` for time-series data
2. Use `GET /api/contacts?[filters]` for segmentation
3. Use `GET /api/deals?[filters]` for deal analysis
4. Use `GET /api/tasks/counts` for task performance
5. Use `POST /api/contacts/export` for external analysis

### Peak Hours Analysis

The analytics API provides the top 5 busiest hours. Use this for:

- Scheduling staff during high-call-volume periods
- Planning marketing campaigns
- Setting voice agent capacity expectations

### Sentiment Tracking

Each call includes a `sentiment_score` (-1.0 to +1.0). The contact's `sentiment_average` is a rolling average. Use this to identify unhappy customers, upsell opportunities, and track sentiment trends.

---

## 29. Troubleshooting and Common Issues

### Contact Not Found After Call

**Symptom:** A caller's contact record does not appear.

**Possible Causes:**

1. Phone number format mismatch. Ensure E.164 format.
2. Cache not yet refreshed (5-minute interval).
3. Tenant ID mismatch between voice agent and dashboard.

**Resolution:** Check the phone_normalized field. Trigger a manual cache refresh if needed.

### Deal Not Appearing in Pipeline

**Symptom:** An auto-created deal is missing from the Kanban board.

**Possible Causes:**

1. Deal was archived (check archived_at is null).
2. Deal stage does not match current industry config.
3. Post-call automation failed silently.

**Resolution:** Check API logs for `[AUTOMATION]` prefix errors. Query deals directly via API with no filters.

### Engagement Score Seems Wrong

**Symptom:** Score does not match expected value.

**Possible Causes:**

1. Score has not been recalculated since last interaction.
2. Call/booking data is outside the scoring time windows (30/90 days).
3. Recency factor decayed since last contact.

**Resolution:** Trigger manual recalculation: `POST /api/contacts/:id/recalculate-score`

### Tasks Not Auto-Created

**Symptom:** Expected tasks after escalation or missed call are missing.

**Possible Causes:**

1. contactId was null on the call (automation skipped).
2. Automation threw an error (check server logs).
3. Call outcome was not "escalation" or status was not "missed".

**Resolution:** Verify call record has correct contact_id and outcome_type. Check server logs for `[AUTOMATION]` errors.

### Notification Stuck in "Pending"

**Symptom:** Notification never transitions to "sent".

**Possible Causes:**

1. Queue processor has not run.
2. Contact has do_not_sms or do_not_email flag.
3. Provider credentials are misconfigured.

**Resolution:** Manually trigger `POST /api/notifications/process-queue`. Check notification_preferences for the tenant.

---

## 30. API Reference for CRM Operations

### Base URL

All API endpoints are relative to your Lumentra API base URL. Authentication is required via session token, and the `X-Tenant-ID` header must be included in every request.

### Contacts API

| Method | Endpoint                            | Description             |
| ------ | ----------------------------------- | ----------------------- |
| GET    | /api/contacts                       | List/search contacts    |
| GET    | /api/contacts/lookup                | Fast phone lookup       |
| GET    | /api/contacts/lookup/email          | Email lookup            |
| GET    | /api/contacts/:id                   | Get single contact      |
| POST   | /api/contacts                       | Create contact          |
| PUT    | /api/contacts/:id                   | Update contact          |
| DELETE | /api/contacts/:id                   | Soft-delete contact     |
| POST   | /api/contacts/find-or-create        | Find or create by phone |
| PATCH  | /api/contacts/:id/status            | Update status           |
| PATCH  | /api/contacts/:id/tags              | Add/remove tags         |
| POST   | /api/contacts/bulk/tags             | Bulk add tag            |
| GET    | /api/contacts/:id/notes             | Get notes               |
| POST   | /api/contacts/:id/notes             | Add note                |
| GET    | /api/contacts/:id/history           | Get activity history    |
| GET    | /api/contacts/:id/bookings          | Get bookings            |
| GET    | /api/contacts/:id/calls             | Get calls               |
| POST   | /api/contacts/import                | Bulk import             |
| POST   | /api/contacts/export                | Export contacts         |
| POST   | /api/contacts/merge                 | Merge duplicates        |
| POST   | /api/contacts/:id/recalculate-score | Recalculate score       |
| GET    | /api/contacts/:id/engagement        | Get score breakdown     |

### Deals API

| Method | Endpoint             | Description           |
| ------ | -------------------- | --------------------- |
| GET    | /api/deals           | List/search deals     |
| GET    | /api/deals/pipeline  | Get pipeline (Kanban) |
| GET    | /api/deals/:id       | Get single deal       |
| POST   | /api/deals           | Create deal           |
| PUT    | /api/deals/:id       | Update deal           |
| PATCH  | /api/deals/:id/stage | Update stage (drag)   |
| DELETE | /api/deals/:id       | Archive deal          |

### Tasks API

| Method | Endpoint                | Description        |
| ------ | ----------------------- | ------------------ |
| GET    | /api/tasks              | List/search tasks  |
| GET    | /api/tasks/counts       | Get task counts    |
| GET    | /api/tasks/upcoming     | Get upcoming tasks |
| GET    | /api/tasks/overdue      | Get overdue tasks  |
| GET    | /api/tasks/:id          | Get single task    |
| POST   | /api/tasks              | Create task        |
| PUT    | /api/tasks/:id          | Update task        |
| PATCH  | /api/tasks/:id/complete | Complete task      |
| DELETE | /api/tasks/:id          | Delete task        |

### Calls API

| Method | Endpoint                  | Description            |
| ------ | ------------------------- | ---------------------- |
| GET    | /api/calls                | List calls             |
| GET    | /api/calls/stats          | Get call statistics    |
| GET    | /api/calls/analytics      | Get analytics (charts) |
| GET    | /api/calls/recent         | Get recent calls       |
| GET    | /api/calls/:id            | Get call details       |
| GET    | /api/calls/:id/transcript | Get transcript         |

### Notifications API

| Method | Endpoint                         | Description        |
| ------ | -------------------------------- | ------------------ |
| GET    | /api/notifications               | List notifications |
| GET    | /api/notifications/:id           | Get notification   |
| POST   | /api/notifications/send          | Send notification  |
| POST   | /api/notifications/preview       | Preview template   |
| GET    | /api/notifications/templates     | List templates     |
| POST   | /api/notifications/templates     | Create template    |
| PUT    | /api/notifications/templates/:id | Update template    |
| GET    | /api/notifications/preferences   | Get preferences    |
| PUT    | /api/notifications/preferences   | Update preferences |
| POST   | /api/notifications/process-queue | Process queue      |

### HTTP Status Codes

| Code | Meaning                    |
| ---- | -------------------------- |
| 200  | Success                    |
| 201  | Created                    |
| 400  | Validation failed          |
| 404  | Resource not found         |
| 409  | Conflict (duplicate phone) |
| 500  | Internal server error      |

---

## Appendix A: Complete Field Reference

### Contact Fields

| Field                         | Type      | Default                 |
| ----------------------------- | --------- | ----------------------- |
| `id`                          | UUID      | Auto-generated          |
| `tenant_id`                   | UUID      | Required                |
| `phone`                       | Text      | Required, unique/tenant |
| `phone_normalized`            | Text      | Auto (E.164)            |
| `email`                       | Text      | null                    |
| `name`                        | Text      | null                    |
| `first_name`                  | Text      | null                    |
| `last_name`                   | Text      | null                    |
| `company`                     | Text      | null                    |
| `source`                      | Enum      | 'call'                  |
| `source_details`              | JSONB     | {}                      |
| `first_contact_at`            | Timestamp | NOW()                   |
| `last_contact_at`             | Timestamp | null                    |
| `last_booking_at`             | Timestamp | null                    |
| `last_call_at`                | Timestamp | null                    |
| `total_calls`                 | Integer   | 0                       |
| `total_bookings`              | Integer   | 0                       |
| `total_completed_bookings`    | Integer   | 0                       |
| `total_cancelled_bookings`    | Integer   | 0                       |
| `total_no_shows`              | Integer   | 0                       |
| `total_sms_sent`              | Integer   | 0                       |
| `total_emails_sent`           | Integer   | 0                       |
| `lifetime_value_cents`        | Integer   | 0                       |
| `average_booking_value_cents` | Integer   | 0                       |
| `engagement_score`            | Integer   | 0                       |
| `sentiment_average`           | Decimal   | null                    |
| `status`                      | Enum      | 'active'                |
| `lead_status`                 | Enum      | null                    |
| `preferred_contact_method`    | Enum      | null                    |
| `preferred_contact_time`      | Text      | null                    |
| `preferred_language`          | Text      | 'en'                    |
| `timezone`                    | Text      | null                    |
| `do_not_call`                 | Boolean   | false                   |
| `do_not_sms`                  | Boolean   | false                   |
| `do_not_email`                | Boolean   | false                   |
| `marketing_opt_in`            | Boolean   | false                   |
| `marketing_opt_in_at`         | Timestamp | null                    |
| `custom_fields`               | JSONB     | {}                      |
| `tags`                        | Text[]    | {}                      |
| `notes`                       | Text      | null                    |
| `avatar_url`                  | Text      | null                    |

**Contact Source Values:** call, booking, import, manual, sms, web

**Contact Status Values:** active, inactive, blocked, vip, churned

**Lead Status Values:** new, contacted, qualified, converted, lost

### Deal Fields

| Field            | Type      | Default          |
| ---------------- | --------- | ---------------- |
| `id`             | UUID      | Auto-generated   |
| `tenant_id`      | UUID      | Required         |
| `name`           | Text      | Required         |
| `description`    | Text      | null             |
| `company`        | Text      | null             |
| `stage`          | Text      | Industry default |
| `sort_index`     | SmallInt  | 0                |
| `amount_cents`   | Integer   | 0                |
| `expected_close` | Date      | null             |
| `contact_id`     | UUID      | null             |
| `call_id`        | UUID      | null             |
| `source`         | Enum      | 'manual'         |
| `created_by`     | Text      | null             |
| `archived_at`    | Timestamp | null             |

**Deal Source Values:** call, web, manual, import

### Task Fields

| Field         | Type      | Default        |
| ------------- | --------- | -------------- |
| `id`          | UUID      | Auto-generated |
| `tenant_id`   | UUID      | Required       |
| `title`       | Text      | Required       |
| `description` | Text      | null           |
| `type`        | Text      | 'follow_up'    |
| `priority`    | Enum      | 'medium'       |
| `due_date`    | Date      | Required       |
| `due_time`    | Time      | null           |
| `done_at`     | Timestamp | null           |
| `contact_id`  | UUID      | null           |
| `deal_id`     | UUID      | null           |
| `call_id`     | UUID      | null           |
| `assigned_to` | Text      | null           |
| `created_by`  | Text      | null           |
| `source`      | Enum      | 'manual'       |

**Task Priority Values:** low, medium, high, urgent

**Task Source Values:** manual, auto, voice_agent

### Call Fields

| Field              | Type      | Default        |
| ------------------ | --------- | -------------- |
| `id`               | UUID      | Auto-generated |
| `tenant_id`        | UUID      | Required       |
| `vapi_call_id`     | Text      | null           |
| `direction`        | Enum      | Required       |
| `status`           | Enum      | Required       |
| `caller_phone`     | Text      | null           |
| `caller_name`      | Text      | null           |
| `started_at`       | Timestamp | null           |
| `ended_at`         | Timestamp | null           |
| `duration_seconds` | Integer   | null           |
| `outcome_type`     | Enum      | null           |
| `summary`          | Text      | null           |
| `sentiment_score`  | Decimal   | null           |
| `intents_detected` | Text[]    | null           |
| `recording_url`    | Text      | null           |
| `transcript`       | JSONB     | null           |
| `metadata`         | JSONB     | null           |
| `contact_id`       | UUID      | null           |
| `booking_id`       | UUID      | null           |

### Notification Fields

| Field                 | Type      | Default        |
| --------------------- | --------- | -------------- |
| `id`                  | UUID      | Auto-generated |
| `tenant_id`           | UUID      | Required       |
| `contact_id`          | UUID      | null           |
| `channel`             | Enum      | Required       |
| `notification_type`   | Enum      | Required       |
| `status`              | Enum      | 'pending'      |
| `recipient`           | Text      | Required       |
| `recipient_name`      | Text      | null           |
| `subject`             | Text      | null           |
| `body`                | Text      | Required       |
| `body_html`           | Text      | null           |
| `template_id`         | UUID      | null           |
| `template_variables`  | JSONB     | {}             |
| `scheduled_at`        | Timestamp | null           |
| `sent_at`             | Timestamp | null           |
| `delivered_at`        | Timestamp | null           |
| `opened_at`           | Timestamp | null           |
| `clicked_at`          | Timestamp | null           |
| `booking_id`          | UUID      | null           |
| `call_id`             | UUID      | null           |
| `provider`            | Text      | null           |
| `provider_message_id` | Text      | null           |
| `error_message`       | Text      | null           |
| `retry_count`         | Integer   | 0              |
| `max_retries`         | Integer   | 3              |
| `next_retry_at`       | Timestamp | null           |

### Contact Activity Fields

| Field           | Type      | Default        |
| --------------- | --------- | -------------- |
| `id`            | UUID      | Auto-generated |
| `tenant_id`     | UUID      | Required       |
| `contact_id`    | UUID      | Required       |
| `activity_type` | Enum      | Required       |
| `description`   | Text      | null           |
| `metadata`      | JSONB     | {}             |
| `related_id`    | UUID      | null           |
| `related_type`  | Text      | null           |
| `performed_by`  | Text      | null           |
| `created_at`    | Timestamp | NOW()          |

### Contact Note Fields

| Field             | Type      | Default        |
| ----------------- | --------- | -------------- |
| `id`              | UUID      | Auto-generated |
| `tenant_id`       | UUID      | Required       |
| `contact_id`      | UUID      | Required       |
| `note_type`       | Enum      | 'general'      |
| `content`         | Text      | Required       |
| `attachments`     | JSONB     | []             |
| `created_by`      | Text      | null           |
| `created_by_name` | Text      | null           |
| `call_id`         | UUID      | null           |
| `booking_id`      | UUID      | null           |
| `is_pinned`       | Boolean   | false          |
| `is_private`      | Boolean   | false          |
| `created_at`      | Timestamp | NOW()          |

### Booking Fields

| Field               | Type      | Default        |
| ------------------- | --------- | -------------- |
| `id`                | UUID      | Auto-generated |
| `tenant_id`         | UUID      | Required       |
| `call_id`           | UUID      | null           |
| `contact_id`        | UUID      | null           |
| `resource_id`       | UUID      | null           |
| `slot_id`           | UUID      | null           |
| `customer_name`     | Text      | Required       |
| `customer_phone`    | Text      | Required       |
| `customer_email`    | Text      | null           |
| `booking_type`      | Text      | Required       |
| `booking_date`      | Date      | Required       |
| `booking_time`      | Time      | Required       |
| `duration_minutes`  | Integer   | null           |
| `notes`             | Text      | null           |
| `status`            | Enum      | 'pending'      |
| `confirmation_code` | Text      | Auto-generated |
| `amount_cents`      | Integer   | null           |
| `reminder_sent`     | Boolean   | false          |
| `reminder_sent_at`  | Timestamp | null           |
| `source`            | Enum      | 'call'         |
| `rescheduled_from`  | UUID      | null           |
| `rescheduled_count` | Integer   | 0              |

---

## Appendix B: Engagement Score Calculation Examples

### Example 1: New Contact (Score: 25)

A contact who called once yesterday, no bookings:

| Factor       | Raw Metric     | Raw Score | Wt  | Pts  |
| ------------ | -------------- | --------- | --- | ---- |
| Booking Freq | 0 bookings/90d | 0         | 25  | 0.0  |
| Recency      | 1 day          | 100       | 25  | 25.0 |
| Call Freq    | 1 call/30d     | 25        | 20  | 5.0  |
| Conversion   | 0%             | 0         | 20  | 0.0  |
| Loyalty      | N/A            | 0         | 10  | 0.0  |

**Total Score: 30 (Warm level)**

### Example 2: Active Customer (Score: 65)

3 calls in the last month, 2 bookings in 90 days, 1 completed:

| Factor       | Raw Metric     | Raw Score | Wt  | Pts  |
| ------------ | -------------- | --------- | --- | ---- |
| Booking Freq | 2 bookings/90d | 66        | 25  | 16.5 |
| Recency      | 3 days         | 100       | 25  | 25.0 |
| Call Freq    | 3 calls/30d    | 75        | 20  | 15.0 |
| Conversion   | 66%            | 100       | 20  | 20.0 |
| Loyalty      | 50% show       | 50        | 10  | 5.0  |

**Total Score: 82 (VIP level)**

### Example 3: VIP Customer (Score: 89)

Weekly caller, regular booker, always shows up:

| Factor       | Raw Metric     | Raw Score | Wt  | Pts  |
| ------------ | -------------- | --------- | --- | ---- |
| Booking Freq | 4 bookings/90d | 100       | 25  | 25.0 |
| Recency      | 2 days         | 100       | 25  | 25.0 |
| Call Freq    | 5 calls/30d    | 100       | 20  | 20.0 |
| Conversion   | 80%            | 100       | 20  | 20.0 |
| Loyalty      | 95% show       | 95        | 10  | 9.5  |

**Total Score: 100 (VIP level)**

This contact would be automatically upgraded to VIP status (3+ calls AND score >= 80).

### Example 4: Dormant Contact (Score: 0)

Called once 4 months ago, never booked:

| Factor       | Raw Metric     | Raw Score | Wt  | Pts |
| ------------ | -------------- | --------- | --- | --- |
| Booking Freq | 0 bookings/90d | 0         | 25  | 0.0 |
| Recency      | 120 days       | 0         | 25  | 0.0 |
| Call Freq    | 0 calls/30d    | 0         | 20  | 0.0 |
| Conversion   | 0%             | 0         | 20  | 0.0 |
| Loyalty      | N/A            | 0         | 10  | 0.0 |

**Total Score: 0 (Cold level)**

### Example 5: High-Value but Infrequent (Score: 52)

Books expensive services but only once every 2 months:

| Factor       | Raw Metric    | Raw Score | Wt  | Pts  |
| ------------ | ------------- | --------- | --- | ---- |
| Booking Freq | 1 booking/90d | 33        | 25  | 8.25 |
| Recency      | 45 days       | 40        | 25  | 10.0 |
| Call Freq    | 0 calls/30d   | 0         | 20  | 0.0  |
| Conversion   | 100%          | 100       | 20  | 20.0 |
| Loyalty      | 100% show     | 100       | 10  | 10.0 |

**Total Score: 48 (Warm level)**

This shows that even high-value customers can have moderate scores if they do not interact frequently.

---

## Appendix C: Industry Pipeline Reference

### All Pipelines at a Glance

**Default (Generic B2B):**

| #   | Stage       | Color  | Terminal |
| --- | ----------- | ------ | -------- |
| 1   | New         | Blue   | No       |
| 2   | Contacted   | Cyan   | No       |
| 3   | Qualified   | Amber  | No       |
| 4   | Proposal    | Purple | No       |
| 5   | Negotiation | Orange | No       |
| 6   | Won         | Green  | Yes      |
| 7   | Lost        | Red    | Yes      |

**Medical / Dental:**

| #   | Stage     | Color  | Terminal |
| --- | --------- | ------ | -------- |
| 1   | Inquiry   | Blue   | No       |
| 2   | Scheduled | Cyan   | No       |
| 3   | Confirmed | Amber  | No       |
| 4   | Completed | Green  | Yes      |
| 5   | No-Show   | Orange | Yes      |
| 6   | Cancelled | Red    | Yes      |

**Restaurant:**

| #   | Stage     | Color  | Terminal |
| --- | --------- | ------ | -------- |
| 1   | Inquiry   | Blue   | No       |
| 2   | Reserved  | Cyan   | No       |
| 3   | Confirmed | Amber  | No       |
| 4   | Seated    | Purple | No       |
| 5   | Completed | Green  | Yes      |
| 6   | No-Show   | Orange | Yes      |
| 7   | Cancelled | Red    | Yes      |

**Hotel / Motel:**

| #   | Stage       | Color  | Terminal |
| --- | ----------- | ------ | -------- |
| 1   | Inquiry     | Blue   | No       |
| 2   | Reserved    | Cyan   | No       |
| 3   | Checked In  | Amber  | No       |
| 4   | Checked Out | Green  | Yes      |
| 5   | Cancelled   | Red    | Yes      |
| 6   | No-Show     | Orange | Yes      |

**Salon:**

| #   | Stage     | Color  | Terminal |
| --- | --------- | ------ | -------- |
| 1   | Inquiry   | Blue   | No       |
| 2   | Booked    | Cyan   | No       |
| 3   | Confirmed | Amber  | No       |
| 4   | Completed | Green  | Yes      |
| 5   | No-Show   | Orange | Yes      |
| 6   | Cancelled | Red    | Yes      |

**Auto Service:**

| #   | Stage       | Color  | Terminal |
| --- | ----------- | ------ | -------- |
| 1   | Inquiry     | Blue   | No       |
| 2   | Quoted      | Cyan   | No       |
| 3   | Scheduled   | Amber  | No       |
| 4   | In Progress | Purple | No       |
| 5   | Completed   | Green  | Yes      |
| 6   | Cancelled   | Red    | Yes      |

### Industry-Specific Task Types

| Industry     | Extra Task Types                  |
| ------------ | --------------------------------- |
| Medical      | Insurance Verification, Rx Refill |
| Dental       | Insurance Verification            |
| Restaurant   | Vendor Order, Event Setup         |
| Auto Service | Parts Order, Vehicle Pickup       |

---

## Appendix D: Industry-Specific Terminology

Lumentra adapts its terminology to match your business type:

| Concept  | Default | Medical     | Restaurant   |
| -------- | ------- | ----------- | ------------ |
| Deal     | Deal    | Case        | Reservation  |
| Deals    | Deals   | Cases       | Reservations |
| Booking  | Booking | Appointment | Reservation  |
| Customer | Contact | Patient     | Guest        |

| Concept  | Hotel       | Salon        | Auto Service   |
| -------- | ----------- | ------------ | -------------- |
| Deal     | Booking     | Appointment  | Service Order  |
| Deals    | Bookings    | Appointments | Service Orders |
| Booking  | Reservation | Appointment  | Service        |
| Customer | Guest       | Client       | Customer       |

This terminology is applied consistently across:

- Page titles and headers
- Table column headers
- Form labels and placeholders
- Empty state messages
- Pipeline stage names
- Task type labels
- Deal creation forms
- Notification templates

---

## Appendix E: Glossary

**Archived Deal:** A deal soft-deleted by setting the `archived_at` timestamp. Excluded from pipeline views.

**Booking:** A confirmed appointment, reservation, or service order. Terminology varies by industry.

**Bulk Operation:** An action on multiple records simultaneously (bulk tag, import, export).

**Call Outcome:** Result classification of a completed call: booking, inquiry, support, escalation, or hangup.

**Churned Contact:** A contact who has stopped engaging, identified by low engagement score and no recent interactions.

**Contact:** A record representing a person who has interacted with the business, identified primarily by phone number.

**Contact Activity:** An audit log entry for a specific action on a contact.

**Contact Note:** A free-form text record attached to a contact.

**Conversion Rate:** Percentage of calls resulting in a booking outcome. (booking outcomes / total calls) \* 100.

**Custom Fields:** A JSONB column allowing arbitrary business-specific key-value data.

**Deal:** A business opportunity in the sales pipeline. Industry-specific labels apply.

**Deal Pipeline:** Visual Kanban board of deals organized by stage.

**Deflection:** The voice agent's attempt to resolve a request before escalating.

**E.164 Format:** International phone format: +[country code][number] (e.g., +15551234567).

**Engagement Level:** Classification from score: cold (0-29), warm (30-59), hot (60-79), vip (80-100).

**Engagement Score:** Numeric value 0-100 quantifying contact engagement via five weighted factors.

**Escalation:** Transferring a caller from the AI voice agent to a human representative.

**Hard Delete:** Permanent removal from the database. Used for tasks only.

**ILIKE:** PostgreSQL case-insensitive pattern matching operator.

**Industry Pipeline:** Deal stages configured for a specific industry type.

**Intent:** A purpose detected from speech (e.g., "booking", "hours_inquiry", "pricing").

**Kanban Board:** Visual tool displaying deals as cards in stage columns.

**Lead Status:** Sales funnel position: new, contacted, qualified, converted, or lost.

**Lifetime Value:** Total revenue from a contact, stored in cents.

**Multi-Tenant:** Architecture where one instance serves multiple customers with data isolation.

**Normalized Phone:** Phone number in standardized E.164 format.

**Optimistic Update:** UI pattern that updates immediately, reverting on server failure.

**Pagination:** Dividing results into pages via `limit` and `offset` parameters.

**Post-Call Automation:** Rules executing after every call: creating deals, tasks, updating contacts.

**RLS (Row-Level Security):** PostgreSQL feature restricting row visibility by policy.

**Recency Decay:** Natural score reduction as the recency factor decreases over time.

**Sentiment Score:** Value from -1.0 (negative) to +1.0 (positive) per call.

**Show Rate:** Percentage of bookings where the customer showed up. Used in the loyalty scoring factor.

**Soft Delete:** Marking a record inactive/archived without database removal.

**Sort Index:** Numeric value determining display order within a pipeline column.

**Tag:** Free-form text label for categorization and filtering.

**Task:** An actionable item: follow-up, callback, email, meeting, etc.

**Tenant:** A business using the Lumentra platform with isolated data.

**Terminal Stage:** A pipeline stage representing a closed deal (won, lost, completed, cancelled, no-show).

**Transcript:** Full text of a voice call conversation, stored as structured JSON.

**VIP:** High-value contact status. Set automatically (3+ calls AND score >= 80) or manually.

**Voice Agent:** The AI phone system that answers calls and performs actions for the business.

---

_This guide covers all CRM functionality available in Lumentra as of March 2026. For deployment and infrastructure documentation, refer to the LiveKit Deployment Status guide. For voice agent configuration, refer to the Agent Setup guide._
