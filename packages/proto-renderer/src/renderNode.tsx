import type { Action, Node } from '@sherizan/proto-manifest';
import { Button, Card, Divider, Modal, Row, Screen, Stack, Text, Toggle } from 'proto-components';
import { Fragment, type ReactNode } from 'react';
import { Pressable } from 'react-native';

export type RenderCtx = {
  state: Record<string, boolean | string>;
  dispatch: (action: Action) => void;
};

// Maps one manifest node to its proto-component, wiring enumerated actions to the
// renderer's dispatch. The components have no onTap/bind props — the renderer owns
// the mapping: onTap → onPress, bind → value/visible + onChange/onClose.
export function renderNode(node: Node, ctx: RenderCtx, key?: number): ReactNode {
  switch (node.type) {
    case 'Screen':
      return (
        <Screen key={key} scrollable={node.scrollable} title={node.title}>
          {renderChildren(node.children, ctx)}
        </Screen>
      );
    case 'Stack':
      return (
        <Stack key={key} gap={node.gap} padding={node.padding}>
          {renderChildren(node.children, ctx)}
        </Stack>
      );
    case 'Row':
      return (
        <Row key={key} gap={node.gap} align={node.align}>
          {renderChildren(node.children, ctx)}
        </Row>
      );
    case 'Text':
      return (
        <Text key={key} size={node.size} color={node.color}>
          {node.value}
        </Text>
      );
    case 'Card': {
      const card = (
        <Card glass={node.glass} padding={node.padding}>
          {renderChildren(node.children, ctx)}
        </Card>
      );
      const onTap = node.onTap;
      return onTap ? (
        <Pressable key={key} onPress={() => ctx.dispatch(onTap)}>
          {card}
        </Pressable>
      ) : (
        <Fragment key={key}>{card}</Fragment>
      );
    }
    case 'Button': {
      const onTap = node.onTap;
      return (
        <Button
          key={key}
          label={node.label}
          variant={node.variant}
          onPress={onTap ? () => ctx.dispatch(onTap) : undefined}
        />
      );
    }
    case 'Toggle': {
      const bind = node.bind;
      const value = bind !== undefined ? Boolean(ctx.state[bind]) : Boolean(node.value);
      const onChange = node.onChange;
      return (
        <Toggle
          key={key}
          label={node.label}
          value={value}
          onChange={(next) => {
            if (onChange) ctx.dispatch(onChange);
            else if (bind !== undefined)
              ctx.dispatch({ action: 'setState', key: bind, value: next });
          }}
        />
      );
    }
    case 'Divider':
      return <Divider key={key} />;
    case 'Modal': {
      const bind = node.bind;
      const visible = bind !== undefined ? Boolean(ctx.state[bind]) : Boolean(node.visible);
      const onClose = node.onClose;
      return (
        <Modal
          key={key}
          title={node.title}
          visible={visible}
          onClose={() => {
            if (onClose) ctx.dispatch(onClose);
            else if (bind !== undefined)
              ctx.dispatch({ action: 'setState', key: bind, value: false });
          }}
        >
          {renderChildren(node.children, ctx)}
        </Modal>
      );
    }
    default:
      return null;
  }
}

function renderChildren(children: Node[], ctx: RenderCtx): ReactNode {
  return children.map((child, i) => renderNode(child, ctx, i));
}
