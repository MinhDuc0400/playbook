import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultFields, DEFAULT_BALL_SPOT } from '@/domain/field';
import type { SimResult } from '@/domain/types';
import { simulate } from '@/engine/simulate';
import { cover3Play, floodPlay, makeInput } from '@/engine/__tests__/fixtures';
import { useMatchupStore } from '@/store/matchupStore';
import type { BuiltSim } from '../buildSimInput';
import { MatchupField } from '../MatchupField';
import { buildQbKeyMap } from '../useQbMode';

const field = createDefaultFields()['5v5'];
let built: BuiltSim;
let result: SimResult;

beforeAll(() => {
  const input = makeInput(floodPlay(), cover3Play());
  built = { input, offense: input.offense, defense: input.defense, defenseFlipped: false };
  result = simulate(input);
});

beforeEach(() => {
  useMatchupStore.getState().reset();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('QB mode on the field (D-23)', () => {
  it('draws key badges, hides separation, and a receiver click picks it', () => {
    const qbKeys = buildQbKeyMap(result, built.offense.players);
    const onQbPick = vi.fn();
    const { rerender } = render(
      <MatchupField
        built={built}
        result={result}
        t={1}
        field={field}
        ballSpot={DEFAULT_BALL_SPOT}
        levels={{}}
        qbKeys={qbKeys}
        hideReadInfo
        onQbPick={onQbPick}
      />,
    );
    qbKeys.forEach((k) => expect(screen.getByTestId(`qb-key-${k.label}`)).toHaveTextContent(k.key));
    expect(screen.queryByTestId('overlay-separation')).toBeNull();
    fireEvent.pointerDown(screen.getByTestId(`token-${qbKeys[1]!.label}`));
    expect(onQbPick).toHaveBeenCalledWith(qbKeys[1]!.id);
    rerender(
      <MatchupField
        built={built}
        result={result}
        t={1}
        field={field}
        ballSpot={DEFAULT_BALL_SPOT}
        levels={{}}
      />,
    );
    expect(screen.queryByTestId('overlay-qbKeys')).toBeNull();
    expect(screen.getByTestId('overlay-separation')).toBeInTheDocument();
  });
});
