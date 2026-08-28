import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Domain } from '../lib/types';
import type { RelationshipRow, UnderstandingRow } from '../lib/queries';
import {
  selectInsightVisualization,
  toUnderstandingSignals,
  type InsightViewModel,
  type SeriesPack,
} from '../lib/insightViz';
import { fetchInsightSeries } from '../lib/observationSeries';
import InsightVisualization from './InsightVisualization';

const SHOWN_KEY = 'ciatta.insightViz.shownDay';

const EMPTY_SERIES: SeriesPack = {
  sleepMinutes: [],
  hrvMs: [],
  rhrBpm: [],
  steps: [],
  energyRating: [],
  moodRating: [],
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export default function InsightVizHost({
  userId,
  understandings,
  relationships = [],
  goals = [],
  featuredDomain,
  focusDomain,
  compact,
  onTry,
  onSelectedId,
  allowStillLearning = true,
}: {
  userId?: string | null;
  understandings: UnderstandingRow[];
  relationships?: RelationshipRow[];
  goals?: string[];
  featuredDomain?: Domain;
  focusDomain?: Domain;
  compact?: boolean;
  onTry?: (domain: Domain) => void;
  onSelectedId?: (id: string) => void;
  allowStillLearning?: boolean;
}) {
  const [series, setSeries] = useState<SeriesPack>(EMPTY_SERIES);
  const [shownCatalogId, setShownCatalogId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(SHOWN_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const parsed = JSON.parse(raw) as { day?: string; id?: string };
        if (parsed.day === todayKey()) setShownCatalogId(parsed.id ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchInsightSeries(userId)
      .then((pack) => {
        if (alive) setSeries(pack);
      })
      .catch(() => {
        if (alive) setSeries(EMPTY_SERIES);
      });
    return () => {
      alive = false;
    };
  }, [userId, understandings.map((u) => u.last_updated).join('|')]);

  const view = useMemo<InsightViewModel | null>(
    () =>
      selectInsightVisualization({
        understandings: toUnderstandingSignals(understandings),
        relationships: relationships.map((r) => ({
          from: r.from_domain,
          to: r.to_domain,
          strength: r.strength,
        })),
        goals,
        series,
        featuredDomain,
        focusDomain,
        shownCatalogId,
        allowStillLearning,
      }),
    [understandings, relationships, goals, series, featuredDomain, focusDomain, shownCatalogId, allowStillLearning]
  );

  useEffect(() => {
    if (!view || view.kind === 'still-learning') return;
    AsyncStorage.setItem(SHOWN_KEY, JSON.stringify({ day: todayKey(), id: view.id })).catch(() => {});
    onSelectedId?.(view.id);
  }, [view, onSelectedId]);

  if (!view || (!allowStillLearning && view.kind === 'still-learning')) return null;

  const tryDomain = view.domain ?? focusDomain ?? featuredDomain ?? understandings[0]?.domain;

  return (
    <InsightVisualization
      view={view}
      compact={compact}
      onTry={onTry && tryDomain && view.tryLabel ? () => onTry(tryDomain) : undefined}
    />
  );
}
