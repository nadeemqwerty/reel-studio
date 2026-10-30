import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {NeutralScene} from './neutral.jsx';

const Root = () => <Composition id="NeutralScene" component={NeutralScene}
  width={1080} height={1920} fps={30} durationInFrames={30}
  calculateMetadata={({props}) => ({durationInFrames: props.scene.durationInFrames,
    width: props.scene.layout?.width ?? 1080, height: props.scene.layout?.height ?? 1920})}/>;
registerRoot(Root);
