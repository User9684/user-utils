import * as jsonpath from "jsonpath";
import { Env } from "../types";

const RDAPDomain = "https://rdap.org/domain/";
const RDAPIP = "https://rdap.org/ip/";

export enum RDAPTypes {
    IP = "IP",
    DOMAIN = "DOMAIN",
}

export type Entity = {
    handle: string;
    roles: string[];
    vcardArray: any[];
    links?: {
        value: string;
        rel: string;
        href: string;
    }[];
    entities?: Entity[];
};

export interface ParsedDomainRDAP {
    raw: any;
    rdaptype: RDAPTypes.DOMAIN;
    handle: string;
    links: {
        self: string;
        related?: string;
    };
    status: string[];
    entities: Entity[];
    events: {
        eventAction: string;
        eventDate: string;
    }[];
    secureDNS?: {
        delegationSigned: boolean;
    };
    nameservers?: {
        ldhName: string;
    }[];
    rdapConformance: string[];
    notices: {
        title: string;
        description: string[];
        links: {
            href: string;
            type: string;
        }[];
    }[];
}

export interface ParsedIPRDAP {
    raw: any;
    rdaptype: RDAPTypes.IP;
    handle: string;
    startAddress: string;
    endAddress: string;
    ipVersion: string;
    name: string;
    type: string;
    country: string;
    parentHandle: string;
    cidr0_cidrs: {
        v6prefix?: string;
        v4prefix?: string;
        length: number;
    }[];
    status: string[];
    entities: Entity[];
    remarks?: {
        description: string[];
    }[];
    links: {
        value: string;
        rel: string;
        href: string;
    }[];
    events: {
        eventAction: string;
        eventDate: string;
    }[];
    rdapConformance: string[];
    notices: {
        title: string;
        description: string[];
        links: {
            href: string;
            type: string;
        }[];
    }[];
    port43: string;
    redacted?: {
        name: {
            description: string;
        };
        reason: {
            description: string;
        };
        prePath: string;
        method: string;
    }[];
}

export type ParsedRDAP = ParsedDomainRDAP | ParsedIPRDAP;

export type FetchRDAPResponse = {
    success: boolean;
    data?: ParsedRDAP | string;
    rdapServer?: string;
};

async function parseRDAP(jsonData: string): Promise<ParsedRDAP | string> {
    try {
        const rdapData = JSON.parse(jsonData);

        switch (rdapData.objectClassName) {
            case "domain":
                return extractDomainInfo(rdapData);
            case "ip network":
                return extractIPInfo(rdapData);
            default:
                throw new Error("Unknown RDAP objectClassName");
        }
    } catch (error) {
        return `Error parsing RDAP data: ${error}`;
    }
}

async function extractDomainInfo(rdapData: any): Promise<ParsedDomainRDAP> {
    return {
        raw: rdapData,
        rdaptype: RDAPTypes.DOMAIN,
        handle: rdapData.handle,
        links: {
            self:
                jsonpath.value(rdapData, '$.links[?(@.rel=="self")].href') ||
                "",
            related: jsonpath.value(
                rdapData,
                '$.links[?(@.rel=="related")].href'
            ),
        },
        status: rdapData.status,
        entities: rdapData.entities,
        events: rdapData.events?.map((event: any) => ({
            eventAction: event.eventAction,
            eventDate: event.eventDate,
        })),
        secureDNS: rdapData.secureDNS,
        nameservers: rdapData.nameservers?.map((ns: any) => ({
            ldhName: ns.ldhName,
        })),
        rdapConformance: rdapData.rdapConformance,
        notices: rdapData.notices?.map((notice: any) => ({
            title: notice.title,
            description: notice.description,
            links: notice.links?.map((link: any) => ({
                href: link.href,
                type: link.type,
            })),
        })),
    };
}

function extractIPInfo(rdapData: any): ParsedIPRDAP {
    return {
        raw: rdapData,
        rdaptype: RDAPTypes.IP,
        handle: rdapData.handle,
        startAddress: rdapData.startAddress,
        endAddress: rdapData.endAddress,
        ipVersion: rdapData.ipVersion,
        name: rdapData.name,
        type: rdapData.type,
        country: rdapData.country,
        parentHandle: rdapData.parentHandle,
        cidr0_cidrs: rdapData.cidr0_cidrs,
        status: rdapData.status,
        entities: rdapData.entities,
        remarks: rdapData.remarks?.map((remark: any) => ({
            description: remark.description,
        })),
        links: rdapData.links?.map((link: any) => ({
            value: link.value,
            rel: link.rel,
            href: link.href,
        })),
        events: rdapData.events?.map((event: any) => ({
            eventAction: event.eventAction,
            eventDate: event.eventDate,
        })),
        rdapConformance: rdapData.rdapConformance,
        notices: rdapData.notices?.map((notice: any) => ({
            title: notice.title,
            description: notice.description,
            links: notice.links?.map((link: any) => ({
                href: link.href,
                type: link.type,
            })),
        })),
        port43: rdapData.port43,
        redacted: rdapData.redacted,
    };
}

async function fetchRDAPData(
    env: Env,
    query: string
): Promise<FetchRDAPResponse> {
    const cachedJSON = await env.RDAPCache.get(query);
    if (cachedJSON !== null) {
        const RDAPData = await parseRDAP(cachedJSON);
        return {
            success: (RDAPData && true) || false,
            data: RDAPData || "Cached JSON was unable to be parsed.",
            rdapServer: "RDAP Cache",
        };
    }

    try {
        const domainResponse = await fetch(`${RDAPDomain}${query}`);
        if (domainResponse.status === 200) {
            const jsonData = await domainResponse.text();

            const RDAPData = await parseRDAP(jsonData);
            const success = (RDAPData && true) || false;

            if (success) {
                env.RDAPCache.put(query, jsonData, {
                    expirationTtl: 60 * 8, // 8 minutes
                });
            }

            return {
                success: success,
                data: RDAPData || "Domain RDAP server returned invalid data.",
                rdapServer: new URL(domainResponse.url).hostname,
            };
        }

        const ipResponse = await fetch(`${RDAPIP}${query}`);
        if (ipResponse.status === 200) {
            const jsonData = await ipResponse.text();

            const RDAPData = await parseRDAP(jsonData);
            const success = (RDAPData && true) || false;

            if (success) {
                env.RDAPCache.put(query, jsonData, {
                    expirationTtl: 60 * 8, // 8 minutes
                });
            }

            return {
                success: success,
                data: RDAPData || "IP RDAP server  returned invalid data.",
                rdapServer: new URL(ipResponse.url).hostname,
            };
        }

        return {
            success: false,
            data: "RDAP server did not respond.",
        };
    } catch (error) {
        return {
            success: false,
            data: error,
        };
    }
}

export { fetchRDAPData };
