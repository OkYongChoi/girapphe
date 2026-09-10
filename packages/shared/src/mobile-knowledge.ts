// A fully populated expression bundle can approach 5.2 MiB when parser-valid
// control code units are JSON-escaped as six ASCII bytes each. Keep explicit
// headroom for that true serialization worst case without accepting an
// unbounded request.
export const MAX_MOBILE_KNOWLEDGE_MUTATION_BYTES = 6 * 1024 * 1024;
