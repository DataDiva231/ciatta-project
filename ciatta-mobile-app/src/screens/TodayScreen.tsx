import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, glass, type } from '../theme/tokens';
import GlassSurface from '../components/GlassSurface';
import type { ActiveCuriosity } from '../lib/curiosity';
import type { CrossDomainUnderstandingRow, RelationshipRow, UnderstandingHistoryRow, UnderstandingRow } from '../lib/queries';
import type { Domain } from '../lib/types';
import { domainLabel } from '../lib/mockData';
import { formatSleepMinutes, type RecentSyncSummary } from '../lib/observations';
import { derivePriority } from '../lib/priority';
import { whyAvailable } from '../lib/whyLayer';
import { domainUnderstandingTitle } from '../lib/voice';
import { displayCopy } from '../lib/displayCopy';
import { selectCareNotice } from '../lib/careConnection';
import ScreenContainer from '../components/ScreenContainer';
import BodySilhouette from '../components/BodySilhouette';
import CuriosityCard from '../components/CuriosityCard';
import Card from '../components/Card';
import TamponWearCard from '../components/TamponWearCard';
import WhySheet from '../overlays/WhySheet';
import { ArrowRightIcon, InfoIcon } from '../components/icons';
import {
  confirmTamponInserted,
  confirmTamponRemoved,
  loadTamponWearUnderstanding,
} from '../lib/tamponWearData';
import { clearTamponWearNotifications, syncTamponWearNotifications } from '../lib/tamponWearNotify';
import type { TamponAbsorbency, TamponWearUnderstanding } from '../lib/tamponWear';

const THANKS_VISIBLE_MS = 3000;

const WORDMARK = require('../../assets/images/wordmark.png');
// The artwork ships white on transparent so it can be tinted to whatever the
// palette calls for; these are its true proportions (3575x1046).
const WORDMARK_ASPECT = 3575 / 1046;
const WORDMARK_HEIGHT = 19;

function greeting(d: Date): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatSyncedAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function syncSummaryLine(summary: RecentSyncSummary): string {
  const parts: string[] = [];
  if (summary.reflection.sleepMinutes != null) {
    parts.push(`${formatSleepMinutes(summary.reflection.sleepMinutes)} sleep`);
  }
  if (summary.reflection.steps != null) {
    parts.push(`${summary.reflection.steps.toLocaleString()} steps`);
  }
  if (summary.reflection.restingHeartRateBpm != null) {
    parts.push(`${Math.round(summary.reflection.restingHeartRateBpm)} bpm resting`);
  }
  const prefix = `Synced ${formatSyncedAgo(summary.syncedAt)}`;
  return displayCopy(parts.length > 0 ? `${prefix}: ${parts.join(' · ')}` : prefix);
}

export default function TodayScreen({
  userId,
  onOpenDiscoveryNudge,
  onOpenUnderstanding,
  onOpenInfo,
  activeCuriosity,
  onAnswerCuriosity,
  hasPendingDiscovery,
  understandings,
  relationships = [],
  preferredName,
  recentSyncSummary,
  goals = [],
  history = [],
  crossDomain = [],
}: {
  userId?: string | null;
  onOpenDiscoveryNudge: () => void;
  onOpenUnderstanding: (domain: Domain) => void;
  onOpenInfo: () => void;
  activeCuriosity: ActiveCuriosity | null;
  onAnswerCuriosity: (answer: string) => Promise<void>;
  hasPendingDiscovery: boolean;
  understandings: UnderstandingRow[];
  relationships?: RelationshipRow[];
  preferredName: string;
  recentSyncSummary: RecentSyncSummary | null;
  goals?: string[];
  history?: UnderstandingHistoryRow[];
  crossDomain?: CrossDomainUnderstandingRow[];
}) {
  const [answered, setAnswered] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tamponWear, setTamponWear] = useState<TamponWearUnderstanding | null>(null);
  const [tamponBleeding, setTamponBleeding] = useState(false);
  const [tamponBusy, setTamponBusy] = useState(false);
  const [tamponTick, setTamponTick] = useState(0);
  const [whyOpen, setWhyOpen] = useState(false);
  const careNotice = selectCareNotice(understandings);

  // The thank-you is an acknowledgement, not a resting state — let it sit
  // long enough to read, then clear so the section collapses away rather
  // than leaving a dead card on the screen for the rest of the day.
  useEffect(() => {
    if (!answered) return;
    const t = setTimeout(() => setAnswered(false), THANKS_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [answered]);

  useEffect(() => {
    const t = setInterval(() => setTamponTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    loadTamponWearUnderstanding(userId)
      .then(async ({ understanding, bleedingNow }) => {
        if (!alive) return;
        setTamponWear(understanding);
        setTamponBleeding(bleedingNow);
        const active =
          understanding.activeTimerState !== 'insufficient' &&
          understanding.activeTimerState !== 'idle';
        if (active) await syncTamponWearNotifications(understanding);
        else await clearTamponWearNotifications();
      })
      .catch(() => {
        if (alive) setTamponWear(null);
      });
    return () => {
      alive = false;
    };
  }, [userId, tamponTick]);

  // Computed per render, not at module load: the app survives midnight in the
  // background, and a header reading yesterday's date is a small betrayal on
  // a screen whose whole claim is that it is up to date.
  const now = new Date();
  const dateLabel = displayCopy(
    now.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  );

  // The most recently updated Understanding is "today's" — whatever the
  // engine last touched is the freshest thing to feature.
  const featured =
    understandings.length > 0
      ? [...understandings].sort(
          (a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
        )[0]
      : null;

  const strengths = Object.fromEntries(
    understandings.map((u) => [u.domain, u.strength])
  ) as Partial<Record<Domain, (typeof understandings)[number]['strength']>>;

  const priority = derivePriority(featured, recentSyncSummary);
  const showWhy =
    featured != null &&
    whyAvailable({
      featured,
      todayNarrative: featured.narrative,
      todayPriority: priority,
      understandings,
      relationships: relationships.map((r) => ({
        from_domain: r.from_domain,
        to_domain: r.to_domain,
      })),
      crossDomain: crossDomain.map((cd) => ({
        from_domain: cd.from_domain,
        to_domain: cd.to_domain,
        narrative: cd.narrative,
      })),
      history,
    });
  const tamponActive =
    tamponWear != null &&
    tamponWear.activeTimerState !== 'insufficient' &&
    tamponWear.activeTimerState !== 'idle';
  const showTampon = tamponWear != null && (tamponActive || tamponBleeding);

  async function handleTamponInserted(absorbency: TamponAbsorbency) {
    if (!userId) return;
    setTamponBusy(true);
    try {
      await confirmTamponInserted(userId, absorbency);
      setTamponTick((n) => n + 1);
    } finally {
      setTamponBusy(false);
    }
  }

  async function handleTamponRemoved() {
    if (!userId) return;
    setTamponBusy(true);
    try {
      await confirmTamponRemoved(userId);
      setTamponTick((n) => n + 1);
    } finally {
      setTamponBusy(false);
    }
  }

  async function handleAnswer(answer: string) {
    setSubmitError(null);
    try {
      await onAnswerCuriosity(answer);
      setAnswered(true);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "That didn't save. Try again."
      );
    }
  }

  return (
    <>
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Image
            source={WORDMARK}
            style={styles.wordmark}
            resizeMode="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel="Ciatta"
          />
          <Text style={styles.greeting}>
            {greeting(now)}
            {preferredName ? `, ${preferredName}` : ''}
          </Text>
          <Text style={styles.date}>{dateLabel}</Text>
          {recentSyncSummary ? (
            <Text style={styles.syncLine} numberOfLines={1} ellipsizeMode="tail">
              {syncSummaryLine(recentSyncSummary)}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="About the Today screen"
          onPress={onOpenInfo}
          hitSlop={10}
        >
          <GlassSurface
            kind="clear"
            interactive
            tintColor={glass.tint}
            style={styles.infoButton}
            fallbackStyle={styles.infoFallback}
          >
            <InfoIcon size={18} color={colors.ink2} />
          </GlassSurface>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <BodySilhouette
          variant="today"
          crop={0.78}
          scale={1.48}
          activeDomain={featured?.domain}
          strengths={strengths}
          links={relationships.map((r) => ({
            from: r.from_domain,
            to: r.to_domain,
            strength: r.strength,
          }))}
          onDomainPress={featured ? onOpenUnderstanding : undefined}
        />
      </View>

      {featured ? (
        <View style={styles.section}>
          <Text style={styles.label}>TODAY'S UNDERSTANDING</Text>
          <Text style={styles.headline}>
            {domainUnderstandingTitle(domainLabel[featured.domain], featured.strength)}.
          </Text>
          <Text style={styles.body}>{featured.narrative}</Text>
          {showWhy ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Why this holds"
            onPress={() => setWhyOpen(true)}
            style={({ pressed }) => [styles.whyRow, pressed && styles.pressedSoft]}
          >
            <Text style={styles.whyLabel}>Why</Text>
            <ArrowRightIcon size={16} color={colors.accent} />
          </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.label}>TODAY'S UNDERSTANDING</Text>
          <Text style={styles.headline}>Your understanding is still taking shape.</Text>
          <Text style={styles.body}>
            There isn't enough evidence yet to notice a pattern. As you share
            more and connect your data, what you've learned will appear here.
          </Text>
        </View>
      )}

      {priority ? (
        <>
          <View style={styles.divider} />
          <View>
            <Text style={styles.label}>TODAY'S PRIORITY</Text>
            <Text
              style={[
                styles.priorityHeadline,
                !priority.measured && styles.priorityOpen,
              ]}
            >
              {priority.text}
            </Text>
            {priority.consider ? (
              <Text style={styles.considerText}>{priority.consider}</Text>
            ) : null}
          </View>
        </>
      ) : null}

      {careNotice ? (
        <>
          <View style={styles.divider} />
          <View>
            <Text style={styles.label}>SOMETHING WORTH DISCUSSING</Text>
            <Text style={styles.body}>{careNotice.noticed}</Text>
            <Text style={styles.considerText}>{careNotice.reason}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Prepare for a provider conversation"
              onPress={() => onOpenUnderstanding(careNotice.domain)}
              style={({ pressed }) => [styles.careCta, pressed && styles.pressedSoft]}
            >
              <Text style={styles.careCtaText}>Prepare for a provider conversation</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {showTampon && tamponWear ? (
        <View style={styles.block}>
          <TamponWearCard
            understanding={tamponWear}
            bleedingNow={tamponBleeding}
            busy={tamponBusy}
            onConfirmInserted={handleTamponInserted}
            onConfirmRemoved={handleTamponRemoved}
          />
        </View>
      ) : null}

      {answered || activeCuriosity ? (
        <View style={styles.block}>
          {answered ? (
            <Card>
              <Text style={styles.thanks}>
                Thank you. This is becoming part of your understanding.
              </Text>
            </Card>
          ) : activeCuriosity ? (
            <>
              <CuriosityCard
                question={activeCuriosity.question}
                purpose={activeCuriosity.purpose}
                options={activeCuriosity.answerOptions}
                onAnswer={handleAnswer}
              />
              {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
            </>
          ) : null}
        </View>
      ) : null}

      {hasPendingDiscovery ? (
        <Card onPress={onOpenDiscoveryNudge} style={styles.nudgeFooter}>
          <Text style={styles.nudgeEyebrow}>NEW DISCOVERY</Text>
          <Text style={styles.nudgeText}>
            Something new is becoming part of your story.
          </Text>
        </Card>
      ) : null}
    </ScreenContainer>
    <WhySheet
      visible={whyOpen}
      featured={featured}
      todayNarrative={featured?.narrative ?? ''}
      todayPriority={priority}
      understandings={understandings}
      relationships={relationships}
      crossDomain={crossDomain}
      history={history}
      goals={goals}
      userId={userId}
      onClose={() => setWhyOpen(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  wordmark: {
    height: WORDMARK_HEIGHT,
    width: WORDMARK_HEIGHT * WORDMARK_ASPECT,
    tintColor: colors.ink,
  },
  greeting: {
    ...fonts.serif,
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink,
    marginTop: 8,
  },
  date: {
    ...fonts.sans,
    fontSize: 13,
    color: colors.ink3,
    marginTop: 6,
  },
  syncLine: {
    ...fonts.sans,
    fontSize: 12.5,
    color: colors.ink3,
    marginTop: 4,
  },
  infoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    overflow: 'hidden',
  },
  infoFallback: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressedSoft: {
    opacity: 0.6,
  },
  hero: {
    // Negative, deliberately: the source PNG carries ~19px of transparent
    // padding above the head (bbox top = 19 of 586), so a zero margin still
    // leaves a visible gap. This pulls the figure past its own dead space.
    marginTop: -16,
    marginBottom: 28,
    backgroundColor: colors.canvas,
  },
  section: {},
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 24,
  },
  label: {
    ...fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.ink3,
    marginBottom: 10,
  },
  headline: {
    ...type.title2,
    color: colors.ink,
    marginBottom: 12,
  },
  body: {
    ...fonts.sans,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.ink2,
  },
  whyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 12,
  },
  whyLabel: {
    ...fonts.sansMedium,
    fontSize: 14,
    color: colors.accent,
  },
  priorityHeadline: {
    ...type.title2,
    color: colors.ink,
  },
  // Open questions sit at body size so they don't shout louder than the
  // understanding above; Halbfett still marks them as the action to take.
  priorityOpen: {
    ...fonts.sansSemiBold,
    fontSize: 14.5,
    lineHeight: 22,
  },
  considerText: {
    ...fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink3,
    marginTop: 8,
  },
  careCta: {
    marginTop: 14,
    alignSelf: 'flex-start',
  },
  careCtaText: {
    ...fonts.sansMedium,
    fontSize: 14,
    color: colors.accent,
  },
  block: {
    marginTop: 28,
  },
  thanks: {
    ...fonts.serif,
    fontSize: 17,
    lineHeight: 23,
    color: colors.ink,
  },
  submitError: {
    ...fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 10,
  },
  nudgeFooter: {
    marginTop: 28,
    marginBottom: 12,
  },
  nudgeEyebrow: {
    ...fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.ink3,
    marginBottom: 6,
  },
  nudgeText: {
    ...type.headline,
    color: colors.ink,
  },
});
