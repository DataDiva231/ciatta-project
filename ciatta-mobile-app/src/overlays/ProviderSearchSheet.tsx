import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radii, type } from '../theme/tokens';
import BottomSheet from '../components/BottomSheet';
import Card from '../components/Card';
import { CloseIcon } from '../components/icons';
import { displayCopy } from '../lib/displayCopy';
import { searchProvidersForUnderstanding, searchProviders, type Provider } from '../lib/providerSearch';

const CARE_TYPE_LABEL: Record<string, string> = {
  'primary-care': 'primary care',
  'ob-gyn': 'an OB/GYN',
  'mental-health': 'a mental health provider',
};

/** Best-effort ZIP extraction from the free-text profile.location field
 * already collected elsewhere in this app — never a geocoding attempt,
 * just a convenience prefill the user can always overwrite. */
function extractZip(location: string | null): string {
  if (!location) return '';
  const match = location.match(/\b\d{5}\b/);
  return match ? match[0] : '';
}

function formatAddress(provider: Provider): string | null {
  const a = provider.address;
  if (!a) return null;
  const line2 = [a.city, a.state, a.postalCode].filter(Boolean).join(', ');
  return displayCopy([a.line1, line2].filter(Boolean).join(', ') || '') || null;
}

export default function ProviderSearchSheet({
  visible,
  understandingId,
  careRecommendationType,
  profileLocation,
  onClose,
  onSelectProvider,
}: {
  visible: boolean;
  understandingId: string | null;
  careRecommendationType: string | null;
  profileLocation: string | null;
  onClose: () => void;
  onSelectProvider: (provider: Provider) => void;
}) {
  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [searchedZip, setSearchedZip] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setZip(extractZip(profileLocation));
      setError(null);
      setProviders(null);
      setSearchedZip(null);
    }
    // Prefill only resets when the sheet opens, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function runSearch(zipValue: string) {
    setLoading(true);
    setError(null);
    try {
      const location = zipValue.trim() ? { postalCode: zipValue.trim() } : undefined;
      const result = understandingId
        ? await searchProvidersForUnderstanding(understandingId, location)
        : await searchProviders(location ?? {});
      setProviders(result.providers);
      setSearchedZip(zipValue.trim() || null);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "The provider directory couldn't be reached. Try again.";
      setError(displayCopy(raw) || "The provider directory couldn't be reached. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-search once the sheet opens with whatever ZIP could be prefilled
  // (including none — NPI Registry still returns specialty-only results
  // without a location filter, just less locally relevant ones).
  useEffect(() => {
    if (visible && providers === null && !loading) {
      runSearch(zip);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, understandingId]);

  const careLabel = careRecommendationType
    ? CARE_TYPE_LABEL[careRecommendationType] ?? careRecommendationType
    : 'a provider';

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightPct={0.85}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.eyebrow}>TALK WITH A PROVIDER</Text>
          <Text style={styles.title}>Find {careLabel}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <CloseIcon />
        </Pressable>
      </View>

      <Text style={styles.subtitle}>
        Based on what you've learned, this is who it may be worth talking to. Results come
        from the public NPI Registry, not a curated recommendation.
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          value={zip}
          onChangeText={setZip}
          placeholder="ZIP code"
          placeholderTextColor={colors.ink3}
          keyboardType="number-pad"
          maxLength={5}
          style={styles.zipInput}
        />
        <Pressable
          onPress={() => runSearch(zip)}
          disabled={loading}
          style={({ pressed }) => [styles.searchButton, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : providers && providers.length === 0 ? (
        <Text style={styles.empty}>
          {searchedZip
            ? `No results near ${searchedZip}. Try a different ZIP code.`
            : 'No results. Try adding a ZIP code.'}
        </Text>
      ) : providers ? (
        <View style={styles.results}>
          {providers.map((provider) => (
            <Card key={provider.id} onPress={() => onSelectProvider(provider)} style={styles.resultCard}>
              <Text style={styles.resultName}>{displayCopy(provider.name)}</Text>
              {provider.specialty[0] ? (
                <Text style={styles.resultSpecialty}>{displayCopy(provider.specialty[0])}</Text>
              ) : null}
              {formatAddress(provider) ? (
                <Text style={styles.resultDetail}>{formatAddress(provider)}</Text>
              ) : null}
              {provider.phone ? (
                <Text style={styles.resultDetail}>{displayCopy(provider.phone.replace(/-/g, ' '))}</Text>
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    ...fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 1.1,
    color: colors.ink3,
    marginBottom: 4,
  },
  title: {
    ...type.title2,
    color: colors.ink,
  },
  subtitle: {
    ...fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.ink2,
    marginTop: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  zipInput: {
    flex: 1,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    ...fonts.sans,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: 10,
  },
  searchButton: {
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  searchButtonText: {
    ...fonts.sansMedium,
    fontSize: 14,
    color: colors.white,
  },
  loading: {
    marginTop: 28,
    alignItems: 'center',
  },
  error: {
    ...fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 20,
  },
  empty: {
    ...fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.ink2,
    marginTop: 20,
  },
  results: {
    marginTop: 18,
    gap: 10,
  },
  resultCard: {
    padding: 16,
  },
  resultName: {
    ...fonts.sansSemiBold,
    fontSize: 15,
    color: colors.ink,
  },
  resultSpecialty: {
    ...fonts.sansMedium,
    fontSize: 12.5,
    color: colors.ink2,
    marginTop: 3,
  },
  resultDetail: {
    ...fonts.sans,
    fontSize: 12.5,
    color: colors.ink2,
    marginTop: 3,
  },
});
