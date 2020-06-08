/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { createRef } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import classNames from "classnames";
import { RovingTabIndexWrapper } from "../../../accessibility/RovingTabIndex";
import AccessibleButton from "../../views/elements/AccessibleButton";
import RoomAvatar from "../../views/avatars/RoomAvatar";
import dis from '../../../dispatcher/dispatcher';
import { Key } from "../../../Keyboard";
import * as RoomNotifs from '../../../RoomNotifs';
import { EffectiveMembership, getEffectiveMembership } from "../../../stores/room-list/membership";
import * as Unread from '../../../Unread';
import * as FormattingUtils from "../../../utils/FormattingUtils";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import ActiveRoomObserver from "../../../ActiveRoomObserver";

/*******************************************************************
 *   CAUTION                                                       *
 *******************************************************************
 * This is a work in progress implementation and isn't complete or *
 * even useful as a component. Please avoid using it until this    *
 * warning disappears.                                             *
 *******************************************************************/

enum NotificationColor {
    // Inverted (None -> Red) because we do integer comparisons on this
    None, // nothing special
    Bold, // no badge, show as unread
    Grey, // unread notified messages
    Red,  // unread pings
}

interface IProps {
    room: Room;
    showMessagePreview: boolean;

    // TODO: Allow falsifying counts (for invites and stuff)
    // TODO: Transparency? Was this ever used?
    // TODO: Incoming call boxes?
}

interface INotificationState {
    symbol: string;
    color: NotificationColor;
}

interface IState {
    hover: boolean;
    notificationState: INotificationState;
    selected: boolean;
}

export default class RoomTile2 extends React.Component<IProps, IState> {
    private roomTile = createRef();

    // TODO: Custom status
    // TODO: Lock icon
    // TODO: Presence indicator
    // TODO: e2e shields
    // TODO: Handle changes to room aesthetics (name, join rules, etc)
    // TODO: scrollIntoView?
    // TODO: hover, badge, etc
    // TODO: isSelected for hover effects
    // TODO: Context menu
    // TODO: a11y

    constructor(props: IProps) {
        super(props);

        this.state = {
            hover: false,
            notificationState: this.getNotificationState(),
            selected: ActiveRoomObserver.activeRoomId === this.props.room.roomId,
        };

        this.props.room.on("Room.receipt", this.handleRoomEventUpdate);
        this.props.room.on("Room.timeline", this.handleRoomEventUpdate);
        this.props.room.on("Room.redaction", this.handleRoomEventUpdate);
        MatrixClientPeg.get().on("Event.decrypted", this.handleRoomEventUpdate);
        ActiveRoomObserver.addListener(this.props.room.roomId, this.onActiveRoomUpdate);
    }

    public componentWillUnmount() {
        if (this.props.room) {
            this.props.room.removeListener("Room.receipt", this.handleRoomEventUpdate);
            this.props.room.removeListener("Room.timeline", this.handleRoomEventUpdate);
            this.props.room.removeListener("Room.redaction", this.handleRoomEventUpdate);
            ActiveRoomObserver.removeListener(this.props.room.roomId, this.onActiveRoomUpdate);
        }
        if (MatrixClientPeg.get()) {
            MatrixClientPeg.get().removeListener("Event.decrypted", this.handleRoomEventUpdate);
        }
    }

    // XXX: This is a bit of an awful-looking hack. We should probably be using state for
    // this, but instead we're kinda forced to either duplicate the code or thread a variable
    // through the code paths. This feels like the least evil option.
    private get roomIsInvite(): boolean {
        return getEffectiveMembership(this.props.room.getMyMembership()) === EffectiveMembership.Invite;
    }

    private handleRoomEventUpdate = (event: MatrixEvent) => {
        const roomId = event.getRoomId();

        // Sanity check: should never happen
        if (roomId !== this.props.room.roomId) return;

        this.updateNotificationState();
    };

    private updateNotificationState() {
        this.setState({notificationState: this.getNotificationState()});
    }

    private getNotificationState(): INotificationState {
        const state: INotificationState = {
            color: NotificationColor.None,
            symbol: null,
        };

        if (this.roomIsInvite) {
            state.color = NotificationColor.Red;
            state.symbol = "!";
        } else {
            const redNotifs = RoomNotifs.getUnreadNotificationCount(this.props.room, 'highlight');
            const greyNotifs = RoomNotifs.getUnreadNotificationCount(this.props.room, 'total');

            // For a 'true count' we pick the grey notifications first because they include the
            // red notifications. If we don't have a grey count for some reason we use the red
            // count. If that count is broken for some reason, assume zero. This avoids us showing
            // a badge for 'NaN' (which formats as 'NaNB' for NaN Billion).
            const trueCount = greyNotifs ? greyNotifs : (redNotifs ? redNotifs : 0);

            // Note: we only set the symbol if we have an actual count. We don't want to show
            // zero on badges.

            if (redNotifs > 0) {
                state.color = NotificationColor.Red;
                state.symbol = FormattingUtils.formatCount(trueCount);
            } else if (greyNotifs > 0) {
                state.color = NotificationColor.Grey;
                state.symbol = FormattingUtils.formatCount(trueCount);
            } else {
                // We don't have any notified messages, but we might have unread messages. Let's
                // find out.
                const hasUnread = Unread.doesRoomHaveUnreadMessages(this.props.room);
                if (hasUnread) {
                    state.color = NotificationColor.Bold;
                    // no symbol for this state
                }
            }
        }

        return state;
    }

    private onTileMouseEnter = () => {
        this.setState({hover: true});
    };

    private onTileMouseLeave = () => {
        this.setState({hover: false});
    };

    private onTileClick = (ev: React.KeyboardEvent) => {
        dis.dispatch({
            action: 'view_room',
            // TODO: Support show_room_tile in new room list
            show_room_tile: true, // make sure the room is visible in the list
            room_id: this.props.room.roomId,
            clear_search: (ev && (ev.key === Key.ENTER || ev.key === Key.SPACE)),
        });
    };

    private onActiveRoomUpdate = (isActive: boolean) => {
        this.setState({selected: isActive});
    };

    public render(): React.ReactElement {
        // TODO: Collapsed state
        // TODO: Invites
        // TODO: a11y proper
        // TODO: Render more than bare minimum

        const classes = classNames({
            'mx_RoomTile2': true,
            'mx_RoomTile2_selected': this.state.selected,
        });

        let badge;
        const hasBadge = this.state.notificationState.color > NotificationColor.Bold;
        if (hasBadge) {
            const hasNotif = this.state.notificationState.color >= NotificationColor.Red;
            const isEmptyBadge = !localStorage.getItem("mx_rl_rt_badgeCount");
            const badgeClasses = classNames({
                'mx_RoomTile2_badge': true,
                'mx_RoomTile2_badgeHighlight': hasNotif,
                'mx_RoomTile2_badgeEmpty': isEmptyBadge,
            });
            const symbol = this.state.notificationState.symbol;
            badge = <div className={badgeClasses}>{isEmptyBadge ? null : symbol}</div>;
        }

        // TODO: the original RoomTile uses state for the room name. Do we need to?
        let name = this.props.room.name;
        if (typeof name !== 'string') name = '';
        name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon

        // TODO: Support collapsed state properly
        // TODO: Tooltip?

        let messagePreview = null;
        if (this.props.showMessagePreview) {
            // TODO: Actually get the real message preview from state
            messagePreview = <div className="mx_RoomTile2_messagePreview">I just ate a pie.</div>;
        }

        const nameClasses = classNames({
            "mx_RoomTile2_name": true,
            "mx_RoomTile2_nameWithPreview": !!messagePreview,
        });

        const avatarSize = 32;
        return (
            <React.Fragment>
                <RovingTabIndexWrapper inputRef={this.roomTile}>
                    {({onFocus, isActive, ref}) =>
                        <AccessibleButton
                            onFocus={onFocus}
                            tabIndex={isActive ? 0 : -1}
                            inputRef={ref}
                            className={classes}
                            onMouseEnter={this.onTileMouseEnter}
                            onMouseLeave={this.onTileMouseLeave}
                            onClick={this.onTileClick}
                            role="treeitem"
                        >
                            <div className="mx_RoomTile2_avatarContainer">
                                <RoomAvatar room={this.props.room} width={avatarSize} height={avatarSize}/>
                            </div>
                            <div className="mx_RoomTile2_nameContainer">
                                <div title={name} className={nameClasses} tabIndex={-1} dir="auto">
                                    {name}
                                </div>
                                {messagePreview}
                            </div>
                            <div className="mx_RoomTile2_badgeContainer">
                                {badge}
                            </div>
                        </AccessibleButton>
                    }
                </RovingTabIndexWrapper>
            </React.Fragment>
        );
    }
}
