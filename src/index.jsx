import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Reel} from './reel.jsx';
const Root = () => <Composition id="Reel" component={Reel} width={1080} height={1920} fps={30}
  durationInFrames={1800} calculateMetadata={({props}) => ({durationInFrames: props.project.durationInFrames})}/>;
registerRoot(Root);
