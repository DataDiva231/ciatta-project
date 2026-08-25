import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import type { ActiveCuriosity } from '../lib/curiosity';
import type { UnderstandingRow } from '../lib/queries';
import type { Domain } from '../lib/types';
import { domainLabel } from '../lib/mockData';
import { formatSleepMinutes, type RecentSyncSummary } from '../lib/observations';
import { derivePriority } from '../lib/priority';
import ScreenContainer from '../components/ScreenContainer';
import BodySilhouette from '../components/BodySilhouette';
import CuriosityCard from '../components/CuriosityCard';
import Card from '../components/Card';
import { ArrowRightIcon, InfoIcon } from '../components/icons';

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
  return parts.length > 0 ? `${prefix} — ${parts.join(' · ')}` : prefix;
}

export default function TodayScreen({
  onOpenDiscoveryNudge,
  onOpenUnderstanding,
  onOpenInfo,
  activeCuriosity,
  onAnswerCuriosity,
  hasPendingDiscovery,
  understandings,
  preferredName,
  recentSyncSummary,
}: {
  onOpenDiscoveryNudge: () => void;
  onOpenUnderstanding: (domain: Domain) => void;
  onOpenInfo: () => void;
  activeCuriosity: ActiveCuriosity | null;
  onAnswerCuriosity: (answer: string) => Promise<void>;
  hasPendingDiscovery: boolean;
  understandings: UnderstandingRow[];
  preferredName: string;
  recentSyncSummary: RecentSyncSummary | null;
}) {
  const [answered, setAnswered] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The thank-you is an acknowledgement, not a resting state — let it sit
  // long enough to read, then clear so the section collapses away rather
  // than leaving a dead card on the screen for the rest of the day.
  useEffect(() => {
    if (!answered) return;
    const t = setTimeout(() => setAnswered(false), THANKS_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [answered]);

  // Computed per render, not at module load: the app survives midnight in the
  // background, and a header reading yesterday's date is a small betrayal on
  // a screen whose whole claim is that it is up to date.
  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // The most recently updated Understanding is "today's" — whatever the
  // engine last touched is the freshest thing to feature.
  const featured =
    understandings.length > 0
      ? [...understandings].sort(
          (a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
        )[0]
      : null;

  const priority = derivePriority(featured, recentSyncSummary);

  async function handleAnswer(answer: string) {
    setSubmitError(null);
    try {
      await onAnswerCuriosity(answer);
      setAnswered(true);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "That didn't save — try again."
      );
    }
  }

  return (
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
          style={({ pressed }) => [styles.infoButton, pressed && styles.pressedSoft]}
        >
          <InfoIcon size={18} color={colors.ink2} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <BodySilhouette
          variant="today"
          crop={0.78}
          scale={1.48}
          marker="sun"
          activeDomain={featured?.domain}
          onDomainPress={featured ? onOpenUnderstanding : undefined}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>TODAY'S UNDERSTANDING</Text>
        {featured ? (
          <>
            <Text style={styles.headline}>
              What I'm noticing about your {domainLabel[featured.domain].toLowerCase()}.
            </Text>
            <Text style={styles.body}>{featured.narrative}</Text>
          </>
        ) : (
          <>
            <Text style={styles.headline}>I'm just getting to know you.</Text>
            <Text style={styles.body}>
              I haven't observed enough yet to notice a pattern. As you share
              more and connect your data, I'll start sharing what I understand
              here.
            </Text>
          </>
        )}
      </View>

      {priority ? (
        <>
          <View style={styles.divider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Today's priority: ${priority.text}`}
            onPress={() => onOpenUnderstanding(priority.domain)}
            style={({ pressed }) => [styles.priorityRow, pressed && styles.pressedSoft]}
          >
            <View style={styles.priorityText}>
              <Text style={styles.label}>TODAY'S PRIORITY</Text>
              <Text style={styles.priorityHeadline}>{priority.text}</Text>
              {priority.consider ? (
                <Text style={styles.considerText}>{priority.consider}</Text>
              ) : null}
            </View>
            <View style={styles.arrowButton}>
              <ArrowRightIcon size={18} color={colors.accent} />
            </View>
          </Pressable>
        </>
      ) : null}

      {answered || activeCuriosity ? (
        <View style={styles.block}>
          {answered ? (
            <Card>
              <Text style={styles.thanks}>
                Thank you. Every observation helps me understand you better.
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
            I've found something worth sharing about your story.
          </Text>
        </Card>
      ) : null}
    </ScreenContainer>
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
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink,
    marginTop: 8,
  },
  date: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink3,
    marginTop: 6,
  },
  syncLine: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink3,
    marginTop: 4,
  },
  infoButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
  },
  section: {},
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 24,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.ink3,
    marginBottom: 10,
  },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 26,
    lineHeight: 33,
    color: colors.ink,
    marginBottom: 12,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.ink2,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  priorityText: {
    flex: 1,
  },
  priorityHeadline: {
    fontFamily: fonts.serif,
    fontSize: 26,
    lineHeight: 33,
    color: colors.ink,
  },
  considerText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink3,
    marginTop: 8,
  },
  arrowButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: {
    marginTop: 28,
  },
  thanks: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 23,
    color: colors.ink,
  },
  submitError: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 10,
  },
  nudgeFooter: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
    marginTop: 28,
    marginBottom: 12,
  },
  nudgeEyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.accent,
    marginBottom: 6,
  },
  nudgeText: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.ink,
    lineHeight: 24,
  },
});
