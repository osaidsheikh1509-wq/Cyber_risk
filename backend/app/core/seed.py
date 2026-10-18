from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.risk_calculator import calculate_risk
from app.models.threat import Threat, TimelineEvent


def seed_threats_if_empty(db: Session = None) -> int:
    """Seed 25 realistic cybersecurity threats with timeline events if the table or collection is empty."""
    now = datetime.now(timezone.utc)

    # Check if MongoDB is active and db is None
    if db is None:
        try:
            from app.repositories.dependencies import get_active_backend_name
            if get_active_backend_name() == "mongo":
                from app.core.mongo import get_mongo_db
                from app.repositories.mongo_repo import MongoThreatRepository, MongoTimelineRepository
                mongo_db = get_mongo_db()
                t_repo = MongoThreatRepository(mongo_db)
                tl_repo = MongoTimelineRepository(mongo_db)
                count = t_repo.count()
                if count > 0:
                    return count

                for item in raw_threats:
                    created_dt = now - timedelta(days=item["days_ago"], hours=item["days_ago"] % 6)
                    updated_dt = created_dt + timedelta(hours=min(item["days_ago"] * 3, 48))
                    created_t = t_repo.create({
                        "title": item["title"],
                        "description": item["description"],
                        "category": item["category"],
                        "likelihood": item["likelihood"],
                        "impact": item["impact"],
                        "status": item["status"],
                        "affected_asset": item["affected_asset"],
                        "created_at": created_dt,
                        "updated_at": updated_dt,
                    })
                    for idx, (event_type, desc) in enumerate(item["events"]):
                        event_dt = created_dt + timedelta(hours=idx * 4 + 1)
                        tl_repo.create(
                            threat_id=created_t["id"],
                            event_type=event_type,
                            description=desc,
                            created_at=event_dt,
                        )
                return len(raw_threats)
        except Exception:
            pass

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        count = db.query(Threat).count()
        if count > 0:
            return count

        raw_threats = [
            # 1. Ransomware - Critical
            {
                "title": "BlackCat/ALPHV Ransomware Pre-Attack Reconnaissance",
                "description": "Suspicious PowerShell scripts invoking living-off-the-land binaries (vssadmin, bcdedit) and staging payloads on backup storage.",
                "category": "Ransomware",
                "likelihood": 5,
                "impact": 5,
                "status": "Investigating",
                "affected_asset": "nas-backup-storage-us-east, corp-ad-domain-controller-01",
                "days_ago": 2,
                "events": [
                    ("CREATED", "Endpoint detection agent flagged execution of vssadmin delete shadows."),
                    ("STATUS_CHANGED", "Incident commander escalated to Tier 3 SOC; isolation protocol initiated."),
                ],
            },
            # 2. Cloud Misconfiguration - Critical
            {
                "title": "Publicly Writable AWS S3 Bucket Holding Customer PII",
                "description": "Customer export archive bucket found with ACL granting AuthenticatedUsers full write and public read permission.",
                "category": "Cloud Misconfiguration",
                "likelihood": 4,
                "impact": 5,
                "status": "Mitigated",
                "affected_asset": "s3://analytics-export-customer-pii-production",
                "days_ago": 26,
                "events": [
                    ("CREATED", "Cloud security posture scan detected public ACL on sensitive PII bucket."),
                    ("ASSESSMENT_UPDATED", "Evaluated impact as catastrophic due to GDPR compliance implications."),
                    ("STATUS_CHANGED", "Bucket policy locked down with AWS Block Public Access; IAM keys rotated."),
                ],
            },
            # 3. Credential Attack - Critical
            {
                "title": "Distributed Password Spraying Against Okta Single Sign-On",
                "description": "Coordinated brute force attack from 400+ residential proxy IPs targeting privileged infrastructure engineer accounts.",
                "category": "Credential Attack",
                "likelihood": 5,
                "impact": 4,
                "status": "Investigating",
                "affected_asset": "okta-iam-tenant-production",
                "days_ago": 1,
                "events": [
                    ("CREATED", "SOC alerted to 15,000 failed authentication events within a 10-minute window."),
                    ("STATUS_CHANGED", "Risk-based MFA challenge policy enforced; IP range added to blocklist."),
                ],
            },
            # 4. Vulnerability - Critical
            {
                "title": "CVE-2024-3400 PAN-OS GlobalProtect Zero-Day Command Injection",
                "description": "Unauthenticated remote code execution vulnerability actively exploited on perimeter enterprise VPN gateways.",
                "category": "Vulnerability",
                "likelihood": 4,
                "impact": 5,
                "status": "Mitigated",
                "affected_asset": "vpn-gateway-hq-edge-01, vpn-gateway-dr-02",
                "days_ago": 24,
                "events": [
                    ("CREATED", "Threat intelligence alert received regarding active zero-day exploitation in wild."),
                    ("STATUS_CHANGED", "Emergency hotfix installed; perimeter IOCs scanned with clean results."),
                ],
            },
            # 5. Data Breach - Critical
            {
                "title": "Unauthorized S3 Data Exfiltration via Compromised IAM Role",
                "description": "Unusual egress spike of 850GB from production billing database snapshots to unknown external IP.",
                "category": "Data Breach",
                "likelihood": 4,
                "impact": 5,
                "status": "Investigating",
                "affected_asset": "arn:aws:iam::123456789012:role/BillingServiceRole",
                "days_ago": 3,
                "events": [
                    ("CREATED", "GuardDuty anomaly detection flagged high-volume data exfiltration from billing snapshot bucket."),
                    ("STATUS_CHANGED", "IAM role sessions revoked; forensic snapshot collection underway."),
                ],
            },
            # 6. Insider Threat - High
            {
                "title": "Departing Engineer Bulk-Downloading Source Code Repositories",
                "description": "Employee submitted 2-week resignation notice and immediately cloned 48 proprietary core microservice repositories.",
                "category": "Insider Threat",
                "likelihood": 4,
                "impact": 3,
                "status": "Open",
                "affected_asset": "github-enterprise-org-core-repos",
                "days_ago": 5,
                "events": [
                    ("CREATED", "DLP agent detected anomalous git clone burst exceeding 300% historical baseline."),
                ],
            },
            # 7. Phishing - High
            {
                "title": "Executive Spear-Phishing Campaign Mimicking DocuSign Wire Authorization",
                "description": "Targeted OAuth device authorization phishing campaign targeting senior executives in Finance and HR.",
                "category": "Phishing",
                "likelihood": 4,
                "impact": 4,
                "status": "Investigating",
                "affected_asset": "exchange-hybrid-mail-relay, c-suite-executive-mailboxes",
                "days_ago": 6,
                "events": [
                    ("CREATED", "Phishing triage queue received 3 employee-reported email headers from external spoofed domain."),
                    ("STATUS_CHANGED", "Malicious sender domain and reverse proxy phishing lure quarantined at mail gateway."),
                ],
            },
            # 8. Third-Party Risk - High
            {
                "title": "Compromised NPM Dependency in Frontend Checkout Flow",
                "description": "Transitive dependency in React package tree injected with obfuscated credit card skimmer payload.",
                "category": "Third-Party Risk",
                "likelihood": 3,
                "impact": 5,
                "status": "Mitigated",
                "affected_asset": "customer-checkout-frontend-spa",
                "days_ago": 18,
                "events": [
                    ("CREATED", "Software Composition Analysis (SCA) pipeline blocked build containing rogue dependency."),
                    ("STATUS_CHANGED", "Package pinned to verified SHA and patched release deployed within 1 hour."),
                ],
            },
            # 9. Malware - High
            {
                "title": "Qakbot Loader Infiltrating Finance Department Workstation",
                "description": "Macro-enabled Excel invoice downloaded from email attachment dropped banking trojan loader in Temp directory.",
                "category": "Malware",
                "likelihood": 3,
                "impact": 4,
                "status": "Mitigated",
                "affected_asset": "fin-ws-104-win11.corp.internal",
                "days_ago": 15,
                "events": [
                    ("CREATED", "EDR sensor quarantined Trojan:Win32/Qakbot.gen payload in AppData/Local/Temp."),
                    ("STATUS_CHANGED", "Endpoint isolated, re-imaged, and user Active Directory credentials cycled."),
                ],
            },
            # 10. DDoS - High
            {
                "title": "Volumetric HTTP/2 Rapid Reset Flood Against Public API Gateway",
                "description": "Sustained 4.2 million requests/second DDoS attack exploiting CVE-2023-44487 causing 504 gateway timeouts.",
                "category": "DDoS",
                "likelihood": 4,
                "impact": 3,
                "status": "Closed",
                "affected_asset": "api.cybertracker.io-cloudflare-edge",
                "days_ago": 22,
                "events": [
                    ("CREATED", "Automated synthetic monitor tripped due to error rate exceeding 15% across global regions."),
                    ("STATUS_CHANGED", "Cloudflare Under Attack Mode enabled; rate-limiting signatures deployed."),
                    ("STATUS_CHANGED", "Attack subsided; latency normalized to baseline SLA of 45ms."),
                ],
            },
            # 11. Vulnerability - High
            {
                "title": "SQL Injection in Legacy Customer Reporting Endpoint",
                "description": "Unsanitized user input in query parameter directly concatenated into backend PostgreSQL reporting query.",
                "category": "Vulnerability",
                "likelihood": 3,
                "impact": 4,
                "status": "Mitigated",
                "affected_asset": "legacy-reporting-service-v1",
                "days_ago": 20,
                "events": [
                    ("CREATED", "Bug bounty vulnerability submission demonstrated time-based blind SQL injection."),
                    ("STATUS_CHANGED", "Prepared statements implemented via SQLAlchemy ORM; regression tests added."),
                ],
            },
            # 12. Credential Attack - High
            {
                "title": "Exposed Hardcoded AWS Production Secret in Public GitHub Gist",
                "description": "Developer inadvertently pasted environment dump containing AWS_SECRET_ACCESS_KEY into personal Gist.",
                "category": "Credential Attack",
                "likelihood": 3,
                "impact": 5,
                "status": "Closed",
                "affected_asset": "aws-production-root-account-credentials",
                "days_ago": 25,
                "events": [
                    ("CREATED", "GitGuardian webhook notified Security Operations of exposed secret key within 90 seconds."),
                    ("STATUS_CHANGED", "Key deleted immediately in AWS IAM; CloudTrail verified zero unauthorized calls."),
                ],
            },
            # 13. Phishing - Medium
            {
                "title": "Generic IT Helpdesk Password Expiry Phishing Wave",
                "description": "Broad phishing email blast sent to all-staff aliases claiming Microsoft 365 password expires in 24 hours.",
                "category": "Phishing",
                "likelihood": 4,
                "impact": 2,
                "status": "Closed",
                "affected_asset": "o365-tenant-corp-mailboxes",
                "days_ago": 19,
                "events": [
                    ("CREATED", "Spam filter caught 94% of emails; 6 reached inboxes."),
                    ("STATUS_CHANGED", "Remaining 6 messages purged remotely via Exchange PowerShell compliance search."),
                ],
            },
            # 14. Cloud Misconfiguration - Medium
            {
                "title": "Kubernetes API Server Permitting Anonymous Authentication",
                "description": "Staging Kubernetes cluster control plane configured with --anonymous-auth=true on public IP.",
                "category": "Cloud Misconfiguration",
                "likelihood": 2,
                "impact": 4,
                "status": "Mitigated",
                "affected_asset": "k8s-staging-cluster-control-plane",
                "days_ago": 14,
                "events": [
                    ("CREATED", "Wiz audit flagged insecure API server flag on staging cluster."),
                    ("STATUS_CHANGED", "Cluster manifest patched with RBAC enforced and IP allowlisting."),
                ],
            },
            # 15. Third-Party Risk - Medium
            {
                "title": "SaaS Customer Support Vendor Experiencing Security Incident",
                "description": "Helpdesk SaaS provider published advisory regarding potential unauthorized session token disclosure.",
                "category": "Third-Party Risk",
                "likelihood": 3,
                "impact": 3,
                "status": "Investigating",
                "affected_asset": "zendesk-support-integration-api",
                "days_ago": 8,
                "events": [
                    ("CREATED", "Vendor security bulletin ingested; Vendor Risk Management assessment initiated."),
                    ("STATUS_CHANGED", "Vendor API tokens rotated and access logs audited for anomalous queries."),
                ],
            },
            # 16. Ransomware - Medium
            {
                "title": "Suspicious Lateral Movement via WMI on Isolated Sandbox",
                "description": "Automated security sandbox triggered alerts for pass-the-hash behavior across segmented QA servers.",
                "category": "Ransomware",
                "likelihood": 2,
                "impact": 4,
                "status": "Closed",
                "affected_asset": "qa-sandbox-isolated-vlan",
                "days_ago": 28,
                "events": [
                    ("CREATED", "Honeytoken account triggered internal network IDS alert."),
                    ("STATUS_CHANGED", "Investigated as red team exercise test; confirmed benign simulation."),
                ],
            },
            # 17. Malware - Medium
            {
                "title": "Cryptomining Binary Detected on Development Container Host",
                "description": "XMRig Monero miner container running inside neglected dev host consuming 99% CPU.",
                "category": "Malware",
                "likelihood": 3,
                "impact": 2,
                "status": "Mitigated",
                "affected_asset": "dev-docker-host-04.us-west-2",
                "days_ago": 16,
                "events": [
                    ("CREATED", "Datadog CPU threshold alert triggered for dev-docker-host-04."),
                    ("STATUS_CHANGED", "Container terminated, exposed Docker daemon socket closed, host patched."),
                ],
            },
            # 18. Insider Threat - Medium
            {
                "title": "Unauthorized Sudo Privilege Escalation on Analytics Node",
                "description": "Junior data scientist executed unauthorized privilege escalation script to bypass disk quota.",
                "category": "Insider Threat",
                "likelihood": 3,
                "impact": 2,
                "status": "Closed",
                "affected_asset": "jupyter-analytics-compute-02",
                "days_ago": 21,
                "events": [
                    ("CREATED", "Auditd logged sudoers file modification without change ticket reference."),
                    ("STATUS_CHANGED", "User interviewed; permissions corrected and disk quota expanded through formal change."),
                ],
            },
            # 19. Vulnerability - Medium
            {
                "title": "Reflected Cross-Site Scripting (XSS) on Marketing Search Bar",
                "description": "Search query parameter reflected in HTML output without adequate entity encoding.",
                "category": "Vulnerability",
                "likelihood": 3,
                "impact": 2,
                "status": "Mitigated",
                "affected_asset": "www.company.com-marketing-site",
                "days_ago": 12,
                "events": [
                    ("CREATED", "DAST scan detected reflected script tags in response body."),
                    ("STATUS_CHANGED", "DOMPurify sanitization library integrated; verified clean."),
                ],
            },
            # 20. DDoS - Medium
            {
                "title": "NTP Amplification UDP Reflection against Authoritative DNS",
                "description": "Port 123 reflection vector generating 45 Gbps inbound UDP traffic targeting primary nameserver.",
                "category": "DDoS",
                "likelihood": 2,
                "impact": 4,
                "status": "Mitigated",
                "affected_asset": "ns1.cybertracker-dns.net",
                "days_ago": 11,
                "events": [
                    ("CREATED", "BGP flowspec detected sudden 300x spike in inbound UDP/123 traffic."),
                    ("STATUS_CHANGED", "Upstream ISP blackholed UDP 123 reflection; secondary DNS answered queries."),
                ],
            },
            # 21. Cloud Misconfiguration - Low
            {
                "title": "AWS CloudWatch Logs Retention Set to Indefinite",
                "description": "Default log groups accumulating data indefinitely without lifecycle retention policy.",
                "category": "Cloud Misconfiguration",
                "likelihood": 2,
                "impact": 2,
                "status": "Open",
                "affected_asset": "aws-cloudwatch-log-groups-all-regions",
                "days_ago": 10,
                "events": [
                    ("CREATED", "Cost and compliance audit flagged lack of 90-day retention policies."),
                ],
            },
            # 22. Credential Attack - Low
            {
                "title": "Single Inactive Service Account with Stale 180-Day Password",
                "description": "Legacy backup agent account has not rotated credentials in over 6 months.",
                "category": "Credential Attack",
                "likelihood": 2,
                "impact": 2,
                "status": "Mitigated",
                "affected_asset": "svc-backup-legacy-agent",
                "days_ago": 27,
                "events": [
                    ("CREATED", "Active Directory credential hygiene report highlighted stale service account."),
                    ("STATUS_CHANGED", "Service account deprecated and disabled in Active Directory."),
                ],
            },
            # 23. Phishing - Low
            {
                "title": "Unsolicited Cold Marketing Inbound Emails with Tracking Pixels",
                "description": "Vendor cold solicitation emails containing aggressive 1x1 tracking beacons.",
                "category": "Phishing",
                "likelihood": 2,
                "impact": 1,
                "status": "Closed",
                "affected_asset": "external-inbound-mail-mx",
                "days_ago": 17,
                "events": [
                    ("CREATED", "Mail filtering categorized sender as bulk marketing."),
                    ("STATUS_CHANGED", "Sender domain added to organization-wide promotional quarantine."),
                ],
            },
            # 24. Data Breach - Low
            {
                "title": "Public SSL Certificate Transparency Log Exposure of Dev Domain",
                "description": "Certificate authority published internal dev staging hostname to public CT log.",
                "category": "Data Breach",
                "likelihood": 2,
                "impact": 2,
                "status": "Mitigated",
                "affected_asset": "dev-internal-api-alpha.corp.com",
                "days_ago": 23,
                "events": [
                    ("CREATED", "External attack surface monitor noticed new entry in public CT logs."),
                    ("STATUS_CHANGED", "Dev hostname moved behind private Cloudflare Zero Trust tunnel."),
                ],
            },
            # 25. Vulnerability - Low
            {
                "title": "Verbose Server Banner Disclosing Nginx 1.18.0 Version",
                "description": "HTTP response headers contain Server: nginx/1.18.0 disclosing minor version number.",
                "category": "Vulnerability",
                "likelihood": 2,
                "impact": 1,
                "status": "Open",
                "affected_asset": "public-docs-static-site",
                "days_ago": 4,
                "events": [
                    ("CREATED", "Vulnerability scanner identified server banner disclosure in HTTP header."),
                ],
            },
        ]

        # Insert threats and timeline events with accurate timestamps
        for item in raw_threats:
            score, level = calculate_risk(item["likelihood"], item["impact"])
            created_dt = now - timedelta(days=item["days_ago"], hours=item["days_ago"] % 6)
            updated_dt = created_dt + timedelta(hours=min(item["days_ago"] * 3, 48))

            threat = Threat(
                title=item["title"],
                description=item["description"],
                category=item["category"],
                likelihood=item["likelihood"],
                impact=item["impact"],
                risk_score=score,
                risk_level=level,
                status=item["status"],
                affected_asset=item["affected_asset"],
                created_at=created_dt,
                updated_at=updated_dt,
            )
            db.add(threat)
            db.flush()  # populate threat.id

            # Add associated timeline events
            for idx, (event_type, desc) in enumerate(item["events"]):
                event_dt = created_dt + timedelta(hours=idx * 4 + 1)
                event = TimelineEvent(
                    threat_id=threat.id,
                    event_type=event_type,
                    description=desc,
                    created_at=event_dt,
                )
                db.add(event)

        db.commit()
        return len(raw_threats)
    finally:
        if should_close:
            db.close()
