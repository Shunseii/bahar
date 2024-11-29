/**
 * Constructs all the allowed subdomains for this api server
 * given the main authorized `domain`.
 */
export const getAllowedDomains = (domains: string[]) => {
  return domains.flatMap((domain) => {
    const isLocal = domain.includes("localhost");
    const protocol = isLocal ? "http" : "https";

    return [`${protocol}://${domain}`, `${protocol}://www.${domain}`];
  });
};
