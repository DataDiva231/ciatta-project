import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import Avatar from './Avatar';

export default function EditorialHeader({
  title,
  subtitle,
  avatarInitial,
  onAvatarPress,
  dark,
}: {
  title: string;
  subtitle?: string;
  avatarInitial?: string;
  onAvatarPress?: () => void;
  dark?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={[styles.title, dark && { color: colors.white }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, dark && { color: 'rgba(255,255,255,0.6)' }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {avatarInitial ? (
        <Avatar initial={avatarInitial} onPress={onAvatarPress} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  textCol: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 30,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink2,
    marginTop: 2,
  },
});
