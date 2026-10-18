import { ThreatCategory } from '../types/threat';

export const CATEGORY_RECOMMENDED_ACTIONS: Record<ThreatCategory, string[]> = {
  Ransomware: [
    'Isolate affected endpoints & disconnect backup storage from network',
    'Capture volatile RAM dumps & forensic disk snapshots',
    'Activate Incident Response Plan & verify offline immutable backups',
  ],
  Phishing: [
    'Purge malicious emails across all mailboxes using message-ID sweep',
    'Force password reset & invalidate active SSO sessions for targeted users',
    'Enforce hardware FIDO2 MFA & update email gateway protection filters',
  ],
  'Credential Attack': [
    'Block malicious source IP addresses at perimeter firewall & WAF layers',
    'Temporarily lock targeted accounts & require out-of-band verification',
    'Audit privileged access logs & enable step-up authentication',
  ],
  Vulnerability: [
    'Deploy emergency WAF virtual patch blocking specific attack vector',
    'Isolate or rate-limit vulnerable endpoints until official patches are staged',
    'Execute authenticated vulnerability scanning across related exposed assets',
  ],
  DDoS: [
    'Engage upstream ISP / Cloudflare DDoS mitigation scrubbing centers',
    'Apply geo-blocking & aggressive rate limiting on edge load balancers',
    'Monitor edge bandwidth utilization & failover critical service endpoints',
  ],
  'Cloud Misconfiguration': [
    'Immediately revoke public access permissions on exposed storage containers',
    'Rotate all cloud API keys, IAM credentials & secrets associated with asset',
    'Audit cloud trail logs for unauthorized read/write access during exposure',
  ],
  'Data Breach': [
    'Terminate active egress sessions & throttle outbound network bandwidth',
    'Identify data scope & engage legal and regulatory data breach teams',
    'Preserve database audit logs & initiate data loss prevention forensics',
  ],
  'Insider Threat': [
    'Suspend internal user account & revoke badge/physical site access',
    'Audit user endpoint activities, file transfers & external USB storage events',
    'Preserve forensic custody of employee device & document audit timeline',
  ],
  'Third-Party Risk': [
    'Temporarily sever interconnect tunnels & VPN access granted to vendor',
    'Request formal incident disclosure & breach impact assessment from vendor',
    'Inspect shared API integrations & enforce strict mutual TLS authentication',
  ],
  Malware: [
    'Isolate host from corporate network & preserve volatile memory image',
    'Run deep EDR root-cause inspection & submit payload for sandbox detonation',
    'Review perimeter proxy logs for Command and Control (C2) beaconing activity',
  ],
};

export function getRecommendedActions(category: ThreatCategory | string): string[] {
  if (category in CATEGORY_RECOMMENDED_ACTIONS) {
    return CATEGORY_RECOMMENDED_ACTIONS[category as ThreatCategory];
  }
  return [
    'Isolate affected system and isolate from internal subnets',
    'Execute authenticated EDR scan to detect persistence mechanisms',
    'Review perimeter firewall and proxy logs for suspicious telemetry',
  ];
}
