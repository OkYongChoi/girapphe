type RouteValue = string | string[] | undefined;

const PROTECTED_ROUTE_ACTION = 'open-protected-route';
const MAX_TOPIC_LENGTH = 120;

const STATIC_DESTINATIONS = {
  admin: '/admin',
  'candidate-inbox': '/candidate-inbox',
  'knowledge-data-controls': '/knowledge-data-controls',
  notes: '/(tabs)/notes',
  progress: '/(tabs)/progress',
  ranking: '/(tabs)/ranking',
  review: '/(tabs)/review',
  subscription: '/subscription',
  topics: '/knowledge-topics',
} as const;

type StaticDestination = keyof typeof STATIC_DESTINATIONS;

export type MobileAuthContinuation =
  | { destination: StaticDestination }
  | { destination: 'knowledge-topic'; topic: string };

export type MobileAuthContinuationParams = {
  continueAction?: RouteValue;
  continueDestination?: RouteValue;
  continueTopic?: RouteValue;
};

export type ResolvedMobileAuthContinuation =
  | (typeof STATIC_DESTINATIONS)[StaticDestination]
  | { pathname: '/knowledge-topic/[topic]'; params: { topic: string } };

function strictRouteValue(value: RouteValue, maxLength: number): string | null {
  if (typeof value !== 'string' || value !== value.trim()) return null;
  if (!value || value.length > maxLength) return null;
  if (Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  })) return null;
  return value;
}

function isStaticDestination(value: string): value is StaticDestination {
  return Object.prototype.hasOwnProperty.call(STATIC_DESTINATIONS, value);
}

export function buildMobileAuthContinuationParams(
  continuation: MobileAuthContinuation,
): Required<Pick<MobileAuthContinuationParams, 'continueAction' | 'continueDestination'>> &
  Pick<MobileAuthContinuationParams, 'continueTopic'> {
  if (continuation.destination === 'knowledge-topic') {
    const topic = strictRouteValue(continuation.topic, MAX_TOPIC_LENGTH);
    if (!topic) {
      return {
        continueAction: PROTECTED_ROUTE_ACTION,
        continueDestination: 'topics',
      };
    }
    return {
      continueAction: PROTECTED_ROUTE_ACTION,
      continueDestination: continuation.destination,
      continueTopic: topic,
    };
  }

  return {
    continueAction: PROTECTED_ROUTE_ACTION,
    continueDestination: continuation.destination,
  };
}

export function resolveMobileAuthContinuation(
  params: MobileAuthContinuationParams,
): ResolvedMobileAuthContinuation | null {
  if (strictRouteValue(params.continueAction, 64) !== PROTECTED_ROUTE_ACTION) return null;

  const destination = strictRouteValue(params.continueDestination, 64);
  if (!destination) return null;
  if (isStaticDestination(destination)) return STATIC_DESTINATIONS[destination];
  if (destination !== 'knowledge-topic') return null;

  const topic = strictRouteValue(params.continueTopic, MAX_TOPIC_LENGTH);
  if (!topic) return null;
  return { pathname: '/knowledge-topic/[topic]', params: { topic } };
}
