import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, strengthColor } from '../theme/tokens';
import { domainLabel, strengthLabel } from '../lib/mockData';
import type { Domain, RelationshipRef } from '../lib/types';
import type {
  RelationshipRow,
  UnderstandingHistoryRow,
  UnderstandingRow,
} from '../lib/queries';
import { buildVisitBrief } from '../lib/visitPrep';
import { insertObservation } from '../lib/observations';
import BottomSheet from '../components/BottomSheet';
import RelationshipList from '../components/RelationshipList';
import Timeline from '../components/Timeline';
import TextField from '../components/TextField';
import PrimaryButton from '../components/PrimaryButton';
import { CloseIcon } from '../components/icons';

const CARE_TYPE_LABEL: Record<string, string> = {
  'primary-care': 'PRIMARY CARE',
  'ob-gyn': 'OB/GYN',
  'mental-health': 'MENTAL HEALTH',
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "3 days" / "6 weeks" / "4 months" — a span someone can feel, not a date. */
function formatSpan(from: string | null): string | null {
  if (!from) return null;
  const days = Math.floor((Date.now() - new Date(from).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  const weeks = Math.round(days / 7);
  if (days < 60) return `${weeks} weeks`;
  return `${Math.round(days / 30)} months`;
}

function formatAgo(value: string | null): string {
  if (!value) return '—';
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export default function UnderstandingSheet({
  domain,
  understandings,
  relationships,
  history,
  userId,
  onClose,
  onHelpLearnMore,
}: {
  domain: Domain | null;
  understandings: UnderstandingRow[];
  relationships: RelationshipRow[];
  history: UnderstandingHistoryRow[];
  userId: string | null;
  onClose: () => void;
  onHelpLearnMore: () => void;
}) {
  // Care Preparation / Provider Feedback state. Hooks run unconditionally —
  // this has to sit above the `!understanding` early return below.
  const [loggingProvider, setLoggingProvider] = useState(false);
  const [providerNote, setProviderNote] = useState('');
  const [savingProviderNote, setSavingProviderNote] = useState(false);
  const [providerNoteSaved, setProviderNoteSaved] = useState(false);
  const [careActionError, setCareActionError] = useState<string | null>(null);

  function handleClose() {
    setLoggingProvider(false);
    setProviderNote('');
    setProviderNoteSaved(false);
    setCareActionError(null);
    onClose();
  }

  const understanding = domain ? understandings.find((u) => u.domain === domain) ?? null : null;

  const relatedDomains: RelationshipRef[] = understanding
    ? relationships
        .filter((r) => r.from_domain === understanding.domain || r.to_domain === understanding.domain)
        .map((r) => ({
          domain: r.from_domain === understanding.domain ? r.to_domain : r.from_domain,
          strength: r.strength,
        }))
    : [];

  const timelineSteps = understanding
    ? history
        .filter((h) => h.understanding_id === understanding.id)
        .map((h, i, arr) => ({
          label: formatDate(h.event_date),
          detail: h.label,
          active: i === arr.length - 1,
        }))
    : [];

  if (!understanding) {
    return <BottomSheet visible={!!domain} onClose={handleClose}>{null}</BottomSheet>;
  }

  const span = formatSpan(understanding.learning_since);
  const confidence = understanding.confidence_label ?? strengthLabel[understanding.strength];
  // Read straight off the row the Understanding Engine wrote — not
  // recomputed here, so there is exactly one place Guidance is derived.
  const guidance = understanding.guidance;

  async function handlePrepareVisit() {
    if (!understanding) return;
    setCareActionError(null);
    const brief = buildVisitBrief({
      domainLabel: domainLabel[understanding.domain],
      narrative: understanding.narrative,
      confidenceLabel: confidence,
      observationsCount: understanding.observations_count,
      learningSpan: span,
      timelineSteps: timelineSteps.map((s) => ({ label: s.label, detail: s.detail })),
      stillLearning: understanding.still_learning,
      guidance: understanding.guidance,
    });
    try {
      await Share.share({ message: brief });
      // The brief itself is never stored — it's assembled fresh from data
      // already on screen. What's worth remembering is that preparing one
      // happened at all, logged the same way every other user action in
      // this app already is: as a manual Observation.
      if (userId) {
        await insertObservation(userId, {
          source: 'manual',
          type: 'visit_prep_shared',
          value: { domain: understanding.domain },
          context: { understandingId: understanding.id },
        });
      }
    } catch (e) {
      setCareActionError(e instanceof Error ? e.message : "That didn't go through — try again.");
    }
  }

  async function handleSaveProviderNote() {
    if (!userId || !understanding) return;
    const note = providerNote.trim();
    if (!note) return;
    setSavingProviderNote(true);
    setCareActionError(null);
    try {
      // 'provider' is its own provenance, distinct from 'manual' — this is
      // what a provider determined, relayed by the user, not the user's
      // own unprompted observation. Feeds back into the same Observations
      // table every other source already writes to, so a future
      // Understanding Engine run can draw on it like any other evidence.
      await insertObservation(userId, {
        source: 'provider',
        type: 'provider_assessment',
        value: { text: note },
        context: { domain: understanding.domain, understandingId: understanding.id },
      });
      setProviderNote('');
      setProviderNoteSaved(true);
      setLoggingProvider(false);
    } catch (e) {
      setCareActionError(e instanceof Error ? e.message : "That didn't save — try again.");
    } finally {
      setSavingProviderNote(false);
    }
  }

  return (
    <BottomSheet visible={!!domain} onClose={handleClose}>
      <View>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>WHAT I UNDERSTAND ABOUT YOUR</Text>
            <Text style={styles.title}>{domainLabel[understanding.domain]}</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={10}>
            <CloseIcon />
          </Pressable>
        </View>

        {/* The finding itself, given the weight it deserves. */}
        <Text style={styles.narrative}>{understanding.narrative}</Text>

        {/* Confidence, stated once, where it belongs — next to the claim it
            qualifies rather than buried in a stat table below. */}
        <View style={styles.confidenceRow}>
          <View
            style={[
              styles.confidenceDot,
              { backgroundColor: strengthColor[understanding.strength] },
            ]}
          />
          <Text style={[styles.confidenceText, { color: strengthColor[understanding.strength] }]}>
            {confidence}
          </Text>
          <Text style={styles.confidenceSep}>·</Text>
          <Text style={styles.confidenceMeta}>updated {formatAgo(understanding.last_updated)}</Text>
        </View>

        <Text style={styles.sectionLabel}>WHY I BELIEVE IT</Text>
        <View style={styles.evidenceStrip}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{understanding.observations_count}</Text>
            <Text style={styles.metricLabel}>readings{'\n'}behind this</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{span ?? '—'}</Text>
            <Text style={styles.metricLabel}>of watching{'\n'}your body</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{timelineSteps.length || '—'}</Text>
            <Text style={styles.metricLabel}>time{timelineSteps.length === 1 ? '' : 's'} this{'\n'}has shifted</Text>
          </View>
        </View>
        <Text style={styles.evidenceFootnote}>
          Learning since {formatDate(understanding.learning_since)}.
        </Text>

        {relatedDomains.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>CONNECTED TO</Text>
            <RelationshipList relationships={relatedDomains} />
          </>
        ) : null}

        {timelineSteps.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>HOW THIS CHANGED</Text>
            <Timeline steps={timelineSteps} />
          </>
        ) : null}

        {understanding.still_learning.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>STILL WORKING OUT</Text>
            {understanding.still_learning.map((q) => (
              <View key={q} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{q}</Text>
              </View>
            ))}
          </>
        ) : null}

        {guidance ? (
          <>
            <Text style={styles.sectionLabel}>WORTH DISCUSSING</Text>
            {understanding.care_recommendation_type ? (
              <Text style={styles.careTypeBadge}>
                {CARE_TYPE_LABEL[understanding.care_recommendation_type] ??
                  understanding.care_recommendation_type}
              </Text>
            ) : null}
            <Text style={styles.bulletText}>{guidance}</Text>

            {userId ? (
              <View style={styles.careActions}>
                <Pressable onPress={handlePrepareVisit} hitSlop={8}>
                  <Text style={styles.careActionLink}>Prepare for my visit</Text>
                </Pressable>
                <Pressable onPress={() => setLoggingProvider((v) => !v)} hitSlop={8}>
                  <Text style={styles.careActionLink}>Log what your provider said</Text>
                </Pressable>
              </View>
            ) : null}

            {loggingProvider ? (
              <View style={{ marginTop: 12 }}>
                <TextField
                  value={providerNote}
                  onChangeText={setProviderNote}
                  placeholder="What did your provider say?"
                  multiline
                />
                <View style={{ marginTop: 10 }}>
                  <PrimaryButton
                    label="Save"
                    onPress={handleSaveProviderNote}
                    loading={savingProviderNote}
                    disabled={!providerNote.trim()}
                  />
                </View>
              </View>
            ) : null}

            {providerNoteSaved ? (
              <Text style={styles.careConfirmation}>Added to your understanding.</Text>
            ) : null}
            {careActionError ? <Text style={styles.careError}>{careActionError}</Text> : null}
          </>
        ) : null}

        <View style={{ marginTop: 28 }}>
          <PrimaryButton label="Help me learn more" onPress={onHelpLearnMore} />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 1.1,
    color: colors.ink3,
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 32,
    color: colors.ink,
  },
  narrative: {
    fontFamily: fonts.serif,
    fontSize: 21,
    lineHeight: 29,
    color: colors.ink,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
  },
  confidenceSep: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink3,
  },
  confidenceMeta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.ink3,
  },
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 1.1,
    color: colors.ink3,
    marginTop: 30,
    marginBottom: 12,
  },
  evidenceStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.canvas,
    borderRadius: 14,
    paddingVertical: 18,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  metricDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  metricValue: {
    fontFamily: fonts.mono,
    fontSize: 20,
    color: colors.evidence,
  },
  metricLabel: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.ink2,
    textAlign: 'center',
    marginTop: 6,
  },
  evidenceFootnote: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink3,
    marginTop: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.ink3,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.ink2,
  },
  careTypeBadge: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 0.8,
    color: colors.accent,
    marginBottom: 6,
  },
  careActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginTop: 12,
  },
  careActionLink: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  careConfirmation: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.evidence,
    marginTop: 12,
  },
  careError: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 10,
  },
});
