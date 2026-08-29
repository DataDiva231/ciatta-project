import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors } from '../theme/tokens';

const SPLASH_VIDEO = require('../../assets/ciatta-splash-video.mp4');
// Same asset TodayScreen uses for its header — ships white-on-transparent so
// it can be tinted per-surface; here it's left untinted (i.e. white) for
// contrast against the video.
const WORDMARK = require('../../assets/images/wordmark.png');
const WORDMARK_ASPECT = 3575 / 1046;
const WORDMARK_WIDTH = 150;

export default function AnimatedSplash({
  ready,
  onFinish,
}: {
  ready: boolean;
  onFinish: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const [videoEnded, setVideoEnded] = useState(false);
  const hasStartedRef = useRef(false);

  // Muted, plays once, no controls — the video itself is the splash, not a
  // logo laid over it, so nothing else is drawn on top of it. `play()` is
  // deliberately NOT called here: this setup callback runs at mount, which
  // can be a moment before the view actually lays out and the native splash
  // is dismissed. Starting playback that early burns some of the video
  // while it's still hidden, so the visible portion ends up shorter than
  // the full ~10s. Playback starts explicitly in onLayout below instead,
  // at the same moment the video actually becomes visible.
  const player = useVideoPlayer(SPLASH_VIDEO, (p) => {
    p.loop = false;
    p.muted = true;
  });

  // The splash's own exit is driven by the video's real end, never a
  // timer — `ready` (fonts + auth session) usually resolves in well under a
  // second and must not be allowed to cut the ~10s video short.
  useEventListener(player, 'playToEnd', () => {
    setVideoEnded(true);
  });

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  useEffect(() => {
    // Wait for the later of the two: the video reaching its natural end,
    // and the app actually being ready to show. In practice the video is
    // almost always the limiting factor.
    if (!videoEnded || !ready) return;
    Animated.timing(exitOpacity, {
      toValue: 0,
      duration: 260,
      delay: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinish();
    });
  }, [videoEnded, ready, exitOpacity, onFinish]);

  return (
    <Animated.View
      style={[styles.container, { opacity: exitOpacity }]}
      onLayout={() => {
        // onLayout can fire more than once — only act on the first, so a
        // later layout pass never restarts playback from the beginning.
        if (hasStartedRef.current) return;
        hasStartedRef.current = true;
        // Wait for the native splash's own hide transition to actually
        // finish, not just for the request to be sent — starting playback
        // as soon as the promise resolves (rather than fire-and-forget)
        // keeps the video from burning part of itself while still covered.
        SplashScreen.hideAsync()
          .catch(() => {})
          .finally(() => player.play());
      }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
          pointerEvents="none"
        />
        <Image
          source={WORDMARK}
          style={styles.wordmark}
          resizeMode="contain"
          accessible
          accessibilityRole="image"
          accessibilityLabel="Ciatta"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Only visible for the instant before the video's first frame lands —
    // covers that gap without ever freezing on a still image of the video.
    backgroundColor: colors.canvas,
    zIndex: 10,
  },
  wordmark: {
    position: 'absolute',
    alignSelf: 'center',
    // Halved from 14% — moves the wordmark about 50% of the way from its
    // old position down to the bottom edge, same size/color/typography.
    bottom: '7%',
    width: WORDMARK_WIDTH,
    height: WORDMARK_WIDTH / WORDMARK_ASPECT,
    tintColor: colors.white,
  },
});
