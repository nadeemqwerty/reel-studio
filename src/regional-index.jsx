import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {RegionalReel} from './regional.jsx';
import {NeutralScene} from './neutral.jsx';
const Root = () => <>
  <Composition id="NeutralScene" component={NeutralScene} width={1080} height={1920} fps={30}
    durationInFrames={150} calculateMetadata={({props}) => ({durationInFrames: props.scene.durationInFrames})}/>
  <Composition id="RegionalReel" component={RegionalReel} width={1080} height={1920} fps={30}
    durationInFrames={1800} calculateMetadata={({props}) => ({durationInFrames: props.project.durationInFrames})}/>
</>;
registerRoot(Root);
