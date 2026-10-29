import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {NeutralScene} from './neutral.jsx';
import {BrandClip, StudioLesson, StudioPreview} from './studio.jsx';
import {previewSamples} from '../lib/production.mjs';
const metadata = (layout, durationInFrames) => ({width: layout.width, height: layout.height, durationInFrames});
const Root = () => <>
  <Composition id="NeutralScene" component={NeutralScene} width={1080} height={1920} fps={30}
    durationInFrames={150} calculateMetadata={({props}) => metadata(props.scene.layout, props.scene.durationInFrames)}/>
  <Composition id="RegionalReel" component={StudioLesson} width={1080} height={1920} fps={30}
    durationInFrames={1800} calculateMetadata={({props}) => metadata(props.project.layout, props.project.durationInFrames)}/>
  <Composition id="BrandClip" component={BrandClip} width={1080} height={1920} fps={30}
    durationInFrames={30} calculateMetadata={({props}) => metadata(props.layout, props.frames)}/>
  <Composition id="StudioPreview" component={StudioPreview} width={1080} height={1920} fps={30}
    durationInFrames={300} calculateMetadata={({props: {project: p}}) => metadata(p.layout,
      Math.round((p.brandConfig.introSeconds + p.brandConfig.outroSeconds + previewSamples(p).length) * 30))}/>
</>;
registerRoot(Root);
