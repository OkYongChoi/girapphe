export type CandidateInboxRequestGuard = Readonly<{
  begin: () => number;
  isLatest: (request: number) => boolean;
}>;

export function createCandidateInboxRequestGuard(): CandidateInboxRequestGuard {
  let latestRequest = 0;

  return {
    begin() {
      latestRequest += 1;
      return latestRequest;
    },
    isLatest(request) {
      return request === latestRequest;
    },
  };
}
