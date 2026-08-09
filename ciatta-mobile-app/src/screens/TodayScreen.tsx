import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import type { ActiveCuriosity } from '../lib/curiosity';
import type { UnderstandingRow } from '../lib/queries';
import { domainLabel } from '../lib/mockData';
import ScreenContainer from '../components/ScreenContainer';
import EditorialHeader from '../components/EditorialHeader';
import BodySilhouette from '../components/BodySilhouette';
import CuriosityCard from '../components/CuriosityCard';
import Card from '../components/Card';

const TODAY_LABEL = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

export default function TodayScreen({
  onOpenDiscoveryNudge,
  activeCuriosity,
  onAnswerCuriosity,
  hasPendingDiscovery,
  understandings,
  preferredName,
}: {
  onOpenDiscoveryNudge: () => void;
  activeCuriosity: ActiveCuriosity | null;
  onAnswerCuriosity: (answer: string) => Promise<void>;
  hasPendingDiscovery: boolean;
  understandings: UnderstandingRow[];
  preferredName: string;
}) {
  const [answered, setAnswered] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The most recently updated Understanding is "today's" — whatever the
  // engine last touched is the freshest thing to feature.
  const featured =
    understandings.length > 0
      ? [...understandings].sort(
          (a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
        )[0]
      : null;

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
      <EditorialHeader
        title={`Good morning, ${preferredName || 'there'}`}
        subtitle={TODAY_LABEL}
      />

      <View style={styles.hero}>
        <BodySilhouette variant="today" crop={0.75} activeDomain={featured?.domain} />
      </View>

      <Card style={styles.heroCard}>
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
      </Card>

      <View style={styles.section}>
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
        ) : (
          <Card>
            <Text style={styles.thanks}>
              Nothing to ask you right now — I'll check in again soon.
            </Text>
          </Card>
        )}
      </View>

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
  hero: {
    marginTop: 4,
    marginBottom: 24,
  },
  heroCard: {
    padding: 22,
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
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.ink3,
    marginBottom: 10,
  },
  headline: {
    fontFamily: fonts.serif,
    fontSize: 27,
    lineHeight: 33,
    color: colors.ink,
    marginBottom: 14,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.ink2,
  },
  section: {
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
});
