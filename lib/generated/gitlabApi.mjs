var ContentType = /* @__PURE__ */ ((ContentType2) => {
  ContentType2["Json"] = "application/json";
  ContentType2["JsonApi"] = "application/vnd.api+json";
  ContentType2["FormData"] = "multipart/form-data";
  ContentType2["UrlEncoded"] = "application/x-www-form-urlencoded";
  ContentType2["Text"] = "text/plain";
  return ContentType2;
})(ContentType || {});
class HttpClient {
  baseUrl = "//gitlab.com";
  securityData = null;
  securityWorker;
  abortControllers = /* @__PURE__ */ new Map();
  customFetch = (...fetchParams) => fetch(...fetchParams);
  baseApiParams = {
    credentials: "same-origin",
    headers: {},
    redirect: "follow",
    referrerPolicy: "no-referrer"
  };
  constructor(apiConfig = {}) {
    Object.assign(this, apiConfig);
  }
  setSecurityData = (data) => {
    this.securityData = data;
  };
  encodeQueryParam(key, value) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === "number" ? value : `${value}`)}`;
  }
  addQueryParam(query, key) {
    return this.encodeQueryParam(key, query[key]);
  }
  addArrayQueryParam(query, key) {
    const value = query[key];
    return value.map((v) => this.encodeQueryParam(key, v)).join("&");
  }
  toQueryString(rawQuery) {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter((key) => "undefined" !== typeof query[key]);
    return keys.map(
      (key) => Array.isArray(query[key]) ? this.addArrayQueryParam(query, key) : this.addQueryParam(query, key)
    ).join("&");
  }
  addQueryParams(rawQuery) {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }
  contentFormatters = {
    ["application/json" /* Json */]: (input) => input !== null && (typeof input === "object" || typeof input === "string") ? JSON.stringify(input) : input,
    ["application/vnd.api+json" /* JsonApi */]: (input) => input !== null && (typeof input === "object" || typeof input === "string") ? JSON.stringify(input) : input,
    ["text/plain" /* Text */]: (input) => input !== null && typeof input !== "string" ? JSON.stringify(input) : input,
    ["multipart/form-data" /* FormData */]: (input) => {
      if (input instanceof FormData) {
        return input;
      }
      return Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(
          key,
          property instanceof Blob ? property : typeof property === "object" && property !== null ? JSON.stringify(property) : `${property}`
        );
        return formData;
      }, new FormData());
    },
    ["application/x-www-form-urlencoded" /* UrlEncoded */]: (input) => this.toQueryString(input)
  };
  mergeRequestParams(params1, params2) {
    return {
      ...this.baseApiParams,
      ...params1,
      ...params2 || {},
      headers: {
        ...this.baseApiParams.headers || {},
        ...params1.headers || {},
        ...params2 && params2.headers || {}
      }
    };
  }
  createAbortSignal = (cancelToken) => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController2 = this.abortControllers.get(cancelToken);
      if (abortController2) {
        return abortController2.signal;
      }
      return void 0;
    }
    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };
  abortRequest = (cancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);
    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };
  request = async ({
    body,
    secure,
    path,
    type,
    query,
    format,
    baseUrl,
    cancelToken,
    ...params
  }) => {
    const secureParams = (typeof secure === "boolean" ? secure : this.baseApiParams.secure) && this.securityWorker && await this.securityWorker(this.securityData) || {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || "application/json" /* Json */];
    const responseFormat = format || requestParams.format;
    return this.customFetch(
      `${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`,
      {
        ...requestParams,
        headers: {
          ...requestParams.headers || {},
          ...type && type !== "multipart/form-data" /* FormData */ ? { "Content-Type": type } : {}
        },
        signal: (cancelToken ? this.createAbortSignal(cancelToken) : requestParams.signal) || null,
        body: typeof body === "undefined" || body === null ? null : payloadFormatter(body)
      }
    ).then(async (response) => {
      const r = response;
      r.data = null;
      r.error = null;
      const responseToParse = responseFormat ? response.clone() : response;
      const data = !responseFormat ? r : await responseToParse[responseFormat]().then((data2) => {
        if (r.ok) {
          r.data = data2;
        } else {
          r.error = data2;
        }
        return r;
      }).catch((e) => {
        r.error = e;
        return r;
      });
      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }
      if (!response.ok) throw data;
      return data;
    });
  };
}
class Api extends HttpClient {
  api = {
    /**
    * @description Lists all access requests for a specified group that are viewable by the authenticated user.
    *
    * @tags access_requests
    * @name GetApiV4GroupsIdAccessRequests
    * @summary List all access requests for a group
    * @request GET:/api/v4/groups/{id}/access_requests
    */
    getApiV4GroupsIdAccessRequests: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/access_requests`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Requests access to a specified group for the authenticated user.
    *
    * @tags access_requests
    * @name PostApiV4GroupsIdAccessRequests
    * @summary Request access to a group
    * @request POST:/api/v4/groups/{id}/access_requests
    */
    postApiV4GroupsIdAccessRequests: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/access_requests`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Approves an access request for a specified user in a group.
    *
    * @tags access_requests
    * @name PutApiV4GroupsIdAccessRequestsUserIdApprove
    * @summary Approve an access request
    * @request PUT:/api/v4/groups/{id}/access_requests/{user_id}/approve
    */
    putApiV4GroupsIdAccessRequestsUserIdApprove: (id, userId, putApiV4GroupsIdAccessRequestsUserIdApprove, params = {}) => this.request({
      path: `/api/v4/groups/${id}/access_requests/${userId}/approve`,
      method: "PUT",
      body: putApiV4GroupsIdAccessRequestsUserIdApprove,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Denies an access request for a specified user in a group.
    *
    * @tags access_requests
    * @name DeleteApiV4GroupsIdAccessRequestsUserId
    * @summary Deny an access request
    * @request DELETE:/api/v4/groups/{id}/access_requests/{user_id}
    */
    deleteApiV4GroupsIdAccessRequestsUserId: (id, userId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/access_requests/${userId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all emoji reactions for a specified epic. This endpoint can be accessed without authentication if the epic is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4GroupsIdEpicsEpicIidAwardEmoji
    * @summary List all emoji reactions for an epic
    * @request GET:/api/v4/groups/{id}/epics/{epic_iid}/award_emoji
    */
    getApiV4GroupsIdEpicsEpicIidAwardEmoji: (id, epicIid, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/epics/${epicIid}/award_emoji`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds an emoji reaction to an epic.
    *
    * @tags award_emoji
    * @name PostApiV4GroupsIdEpicsEpicIidAwardEmoji
    * @summary Add an emoji reaction to an epic
    * @request POST:/api/v4/groups/{id}/epics/{epic_iid}/award_emoji
    */
    postApiV4GroupsIdEpicsEpicIidAwardEmoji: (id, epicIid, postApiV4GroupsIdEpicsEpicIidAwardEmoji, params = {}) => this.request({
      path: `/api/v4/groups/${id}/epics/${epicIid}/award_emoji`,
      method: "POST",
      body: postApiV4GroupsIdEpicsEpicIidAwardEmoji,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified emoji reaction from an epic. This endpoint can be accessed without authentication if the epic is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4GroupsIdEpicsEpicIidAwardEmojiAwardId
    * @summary Retrieve an emoji reaction from an epic
    * @request GET:/api/v4/groups/{id}/epics/{epic_iid}/award_emoji/{award_id}
    */
    getApiV4GroupsIdEpicsEpicIidAwardEmojiAwardId: (awardId, id, epicIid, params = {}) => this.request({
      path: `/api/v4/groups/${id}/epics/${epicIid}/award_emoji/${awardId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified emoji reaction from an epic. Only an administrator or the user who added the reaction can delete it.
    *
    * @tags award_emoji
    * @name DeleteApiV4GroupsIdEpicsEpicIidAwardEmojiAwardId
    * @summary Delete an emoji reaction from an epic
    * @request DELETE:/api/v4/groups/{id}/epics/{epic_iid}/award_emoji/{award_id}
    */
    deleteApiV4GroupsIdEpicsEpicIidAwardEmojiAwardId: (awardId, id, epicIid, params = {}) => this.request({
      path: `/api/v4/groups/${id}/epics/${epicIid}/award_emoji/${awardId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all emoji reactions for a specified comment on an epic. This endpoint can be accessed without authentication if the comment is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4GroupsIdEpicsEpicIidNotesNoteIdAwardEmoji
    * @summary List all emoji reactions for an epic comment
    * @request GET:/api/v4/groups/{id}/epics/{epic_iid}/notes/{note_id}/award_emoji
    */
    getApiV4GroupsIdEpicsEpicIidNotesNoteIdAwardEmoji: (id, epicIid, noteId, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/epics/${epicIid}/notes/${noteId}/award_emoji`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds an emoji reaction to a comment on an epic.
    *
    * @tags award_emoji
    * @name PostApiV4GroupsIdEpicsEpicIidNotesNoteIdAwardEmoji
    * @summary Add an emoji reaction to an epic comment
    * @request POST:/api/v4/groups/{id}/epics/{epic_iid}/notes/{note_id}/award_emoji
    */
    postApiV4GroupsIdEpicsEpicIidNotesNoteIdAwardEmoji: (id, epicIid, noteId, postApiV4GroupsIdEpicsEpicIidNotesNoteIdAwardEmoji, params = {}) => this.request({
      path: `/api/v4/groups/${id}/epics/${epicIid}/notes/${noteId}/award_emoji`,
      method: "POST",
      body: postApiV4GroupsIdEpicsEpicIidNotesNoteIdAwardEmoji,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified emoji reaction from a comment on an epic. This endpoint can be accessed without authentication if the comment is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4GroupsIdEpicsEpicIidNotesNoteIdAwardEmojiAwardId
    * @summary Retrieve an emoji reaction from an epic comment
    * @request GET:/api/v4/groups/{id}/epics/{epic_iid}/notes/{note_id}/award_emoji/{award_id}
    */
    getApiV4GroupsIdEpicsEpicIidNotesNoteIdAwardEmojiAwardId: (awardId, id, epicIid, noteId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/epics/${epicIid}/notes/${noteId}/award_emoji/${awardId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified emoji reaction from a comment on an epic. Only an administrator or the user who added the reaction can delete it.
    *
    * @tags award_emoji
    * @name DeleteApiV4GroupsIdEpicsEpicIidNotesNoteIdAwardEmojiAwardId
    * @summary Delete an emoji reaction from an epic comment
    * @request DELETE:/api/v4/groups/{id}/epics/{epic_iid}/notes/{note_id}/award_emoji/{award_id}
    */
    deleteApiV4GroupsIdEpicsEpicIidNotesNoteIdAwardEmojiAwardId: (awardId, id, epicIid, noteId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/epics/${epicIid}/notes/${noteId}/award_emoji/${awardId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all badges for a specified group.
    *
    * @tags badges
    * @name GetApiV4GroupsIdBadges
    * @summary List all badges for a group
    * @request GET:/api/v4/groups/{id}/badges
    */
    getApiV4GroupsIdBadges: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/badges`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a badge for a specified group.
    *
    * @tags badges
    * @name PostApiV4GroupsIdBadges
    * @summary Create a badge for a group
    * @request POST:/api/v4/groups/{id}/badges
    */
    postApiV4GroupsIdBadges: (id, postApiV4GroupsIdBadges, params = {}) => this.request({
      path: `/api/v4/groups/${id}/badges`,
      method: "POST",
      body: postApiV4GroupsIdBadges,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Previews the final `link_url` and `image_url` for a specified group after resolving the placeholder interpolation.
    *
    * @tags badges
    * @name GetApiV4GroupsIdBadgesRender
    * @summary Retrieve a badge preview for a group
    * @request GET:/api/v4/groups/{id}/badges/render
    */
    getApiV4GroupsIdBadgesRender: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/badges/render`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified badge for a group.
    *
    * @tags badges
    * @name GetApiV4GroupsIdBadgesBadgeId
    * @summary Retrieve a badge for a group
    * @request GET:/api/v4/groups/{id}/badges/{badge_id}
    */
    getApiV4GroupsIdBadgesBadgeId: (id, badgeId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/badges/${badgeId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified badge for a group.
    *
    * @tags badges
    * @name PutApiV4GroupsIdBadgesBadgeId
    * @summary Update a badge for a group
    * @request PUT:/api/v4/groups/{id}/badges/{badge_id}
    */
    putApiV4GroupsIdBadgesBadgeId: (id, badgeId, putApiV4GroupsIdBadgesBadgeId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/badges/${badgeId}`,
      method: "PUT",
      body: putApiV4GroupsIdBadgesBadgeId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified badge from a group.
    *
    * @tags badges
    * @name DeleteApiV4GroupsIdBadgesBadgeId
    * @summary Delete a badge from a group
    * @request DELETE:/api/v4/groups/{id}/badges/{badge_id}
    */
    deleteApiV4GroupsIdBadgesBadgeId: (id, badgeId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/badges/${badgeId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all custom attributes for a specified group.
    *
    * @tags custom_attributes
    * @name GetApiV4GroupsIdCustomAttributes
    * @summary List all custom attributes for a group
    * @request GET:/api/v4/groups/{id}/custom_attributes
    */
    getApiV4GroupsIdCustomAttributes: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/custom_attributes`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified custom attribute for a group.
    *
    * @tags custom_attributes
    * @name GetApiV4GroupsIdCustomAttributesKey
    * @summary Retrieve a custom attribute for a group
    * @request GET:/api/v4/groups/{id}/custom_attributes/{key}
    */
    getApiV4GroupsIdCustomAttributesKey: (key, id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/custom_attributes/${key}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates a custom attribute for a specified group. If the attribute already exists, it is updated, otherwise a new attribute is created.
    *
    * @tags custom_attributes
    * @name PutApiV4GroupsIdCustomAttributesKey
    * @summary Creates or updates a custom attribute for a group
    * @request PUT:/api/v4/groups/{id}/custom_attributes/{key}
    */
    putApiV4GroupsIdCustomAttributesKey: (key, id, putApiV4GroupsIdCustomAttributesKey, params = {}) => this.request({
      path: `/api/v4/groups/${id}/custom_attributes/${key}`,
      method: "PUT",
      body: putApiV4GroupsIdCustomAttributesKey,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified custom attribute for a group.
    *
    * @tags custom_attributes
    * @name DeleteApiV4GroupsIdCustomAttributesKey
    * @summary Delete a custom attribute for a group
    * @request DELETE:/api/v4/groups/{id}/custom_attributes/{key}
    */
    deleteApiV4GroupsIdCustomAttributesKey: (key, id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/custom_attributes/${key}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all visible groups for the authenticated user. Unauthenticated requests return only public groups.
    *
    * @tags groups
    * @name GetApiV4Groups
    * @summary List all groups
    * @request GET:/api/v4/groups
    */
    getApiV4Groups: (query, params = {}) => this.request({
      path: `/api/v4/groups`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a project group. Available only for users who can create groups.
    *
    * @tags groups
    * @name PostApiV4Groups
    * @summary Create a group
    * @request POST:/api/v4/groups
    */
    postApiV4Groups: (postApiV4Groups, params = {}) => this.request({
      path: `/api/v4/groups`,
      method: "POST",
      body: postApiV4Groups,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Updates the attributes for a specified group. You must be an administrator or have the Owner role for the group.
    *
    * @tags groups
    * @name PutApiV4GroupsId
    * @summary Update group attributes
    * @request PUT:/api/v4/groups/{id}
    */
    putApiV4GroupsId: (id, putApiV4GroupsId, params = {}) => this.request({
      path: `/api/v4/groups/${id}`,
      method: "PUT",
      body: putApiV4GroupsId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified group by ID or path.
    *
    * @tags groups
    * @name GetApiV4GroupsId
    * @summary Retrieve a group
    * @request GET:/api/v4/groups/{id}
    */
    getApiV4GroupsId: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Schedules a group for deletion. Groups are deleted at the end of the retention period (30 days by default). Use the `permanently_remove` param to override the retention period.
    *
    * @tags groups
    * @name DeleteApiV4GroupsId
    * @summary Schedule a group for deletion
    * @request DELETE:/api/v4/groups/{id}
    */
    deleteApiV4GroupsId: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Archives a specified group. You must be an administrator or have the Owner role for the group.
    *
    * @tags groups
    * @name PostApiV4GroupsIdArchive
    * @summary Archive a group
    * @request POST:/api/v4/groups/{id}/archive
    */
    postApiV4GroupsIdArchive: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/archive`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Unarchives a specified group. You must be an administrator or have the Owner role for the group.
    *
    * @tags groups
    * @name PostApiV4GroupsIdUnarchive
    * @summary Unarchive a group
    * @request POST:/api/v4/groups/{id}/unarchive
    */
    postApiV4GroupsIdUnarchive: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/unarchive`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Restores a specified group that was previously scheduled for deletion. Can not restore groups outside of the retention period (30 days by default).
    *
    * @tags groups
    * @name PostApiV4GroupsIdRestore
    * @summary Restore a group
    * @request POST:/api/v4/groups/{id}/restore
    */
    postApiV4GroupsIdRestore: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/restore`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all groups shared with a specified group.
    *
    * @tags groups
    * @name GetApiV4GroupsIdGroupsShared
    * @summary List all shared groups
    * @request GET:/api/v4/groups/{id}/groups/shared
    */
    getApiV4GroupsIdGroupsShared: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/groups/shared`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all groups invited to a specified group.
    *
    * @tags groups
    * @name GetApiV4GroupsIdInvitedGroups
    * @summary List all invited groups
    * @request GET:/api/v4/groups/{id}/invited_groups
    */
    getApiV4GroupsIdInvitedGroups: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/invited_groups`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all projects in a specified group accessible to the authenticated user. Unauthenticated requests return only public projects with a limited subset of attributes.
    *
    * @tags groups
    * @name GetApiV4GroupsIdProjects
    * @summary List all projects in a group
    * @request GET:/api/v4/groups/{id}/projects
    */
    getApiV4GroupsIdProjects: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/projects`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all projects shared with a specified group.
    *
    * @tags groups
    * @name GetApiV4GroupsIdProjectsShared
    * @summary List all shared projects
    * @request GET:/api/v4/groups/{id}/projects/shared
    */
    getApiV4GroupsIdProjectsShared: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/projects/shared`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all subgroups for a specified group.
    *
    * @tags groups
    * @name GetApiV4GroupsIdSubgroups
    * @summary List all subgroups
    * @request GET:/api/v4/groups/{id}/subgroups
    */
    getApiV4GroupsIdSubgroups: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/subgroups`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all descendant groups for a specified group.
    *
    * @tags groups
    * @name GetApiV4GroupsIdDescendantGroups
    * @summary List all descendant groups
    * @request GET:/api/v4/groups/{id}/descendant_groups
    */
    getApiV4GroupsIdDescendantGroups: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/descendant_groups`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Transfers a specified project to another group. Administrators only.
    *
    * @tags groups
    * @name PostApiV4GroupsIdProjectsProjectId
    * @summary Transfer a project to a group
    * @request POST:/api/v4/groups/{id}/projects/{project_id}
    */
    postApiV4GroupsIdProjectsProjectId: (id, projectId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/projects/${projectId}`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all groups that a specified source group can be transferred to.
    *
    * @tags groups
    * @name GetApiV4GroupsIdTransferLocations
    * @summary List all transfer locations for a group
    * @request GET:/api/v4/groups/{id}/transfer_locations
    */
    getApiV4GroupsIdTransferLocations: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/transfer_locations`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Transfers a group to another parent group or transforms a subgroup into a top-level group. You must be an administrator or have the Owner role for the group.
    *
    * @tags groups
    * @name PostApiV4GroupsIdTransfer
    * @summary Transfer a group
    * @request POST:/api/v4/groups/{id}/transfer
    */
    postApiV4GroupsIdTransfer: (id, postApiV4GroupsIdTransfer, params = {}) => this.request({
      path: `/api/v4/groups/${id}/transfer`,
      method: "POST",
      body: postApiV4GroupsIdTransfer,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Transfer a group to an organization
    *
    * @tags groups
    * @name PostApiV4GroupsIdTransferToOrganization
    * @request POST:/api/v4/groups/{id}/transfer_to_organization
    */
    postApiV4GroupsIdTransferToOrganization: (id, postApiV4GroupsIdTransferToOrganization, params = {}) => this.request({
      path: `/api/v4/groups/${id}/transfer_to_organization`,
      method: "POST",
      body: postApiV4GroupsIdTransferToOrganization,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Adds a group to a group.
    *
    * @tags groups
    * @name PostApiV4GroupsIdShare
    * @summary Add a group to a group
    * @request POST:/api/v4/groups/{id}/share
    */
    postApiV4GroupsIdShare: (id, postApiV4GroupsIdShare, params = {}) => this.request({
      path: `/api/v4/groups/${id}/share`,
      method: "POST",
      body: postApiV4GroupsIdShare,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Removes a group from a group.
    *
    * @tags groups
    * @name DeleteApiV4GroupsIdShareGroupId
    * @summary Remove a group from a group
    * @request DELETE:/api/v4/groups/{id}/share/{group_id}
    */
    deleteApiV4GroupsIdShareGroupId: (id, groupId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/share/${groupId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Removes a shared project targeting this group. The group Owner can remove a shared project without access to the source project.
    *
    * @tags groups
    * @name DeleteApiV4GroupsIdSharedProjectsProjectId
    * @summary Remove a shared project from a group
    * @request DELETE:/api/v4/groups/{id}/shared_projects/{project_id}
    */
    deleteApiV4GroupsIdSharedProjectsProjectId: (id, projectId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/shared_projects/${projectId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Syncs a specified group with its linked LDAP group. You must be an administrator or have the Owner role for the group.
    *
    * @tags ldap
    * @name PostApiV4GroupsIdLdapSync
    * @summary Sync a group with LDAP
    * @request POST:/api/v4/groups/{id}/ldap_sync
    */
    postApiV4GroupsIdLdapSync: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/ldap_sync`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all audit events for a specified group.
    *
    * @tags audit_events
    * @name GetApiV4GroupsIdAuditEvents
    * @summary List all group audit events
    * @request GET:/api/v4/groups/{id}/audit_events
    */
    getApiV4GroupsIdAuditEvents: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/audit_events`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves an audit event for a specified group. Only available to group Owners and administrators.
    *
    * @tags groups
    * @name GetApiV4GroupsIdAuditEventsAuditEventId
    * @summary Retrieve a group audit event
    * @request GET:/api/v4/groups/{id}/audit_events/{audit_event_id}
    */
    getApiV4GroupsIdAuditEventsAuditEventId: (auditEventId, id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/audit_events/${auditEventId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all SAML users for a specified top-level group. Use the `page` and `per_page` pagination parameters to filter the results.
    *
    * @tags groups
    * @name GetApiV4GroupsIdSamlUsers
    * @summary List all SAML users
    * @request GET:/api/v4/groups/{id}/saml_users
    */
    getApiV4GroupsIdSamlUsers: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/saml_users`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all provisioned users for a specified group.
    *
    * @tags groups
    * @name GetApiV4GroupsIdProvisionedUsers
    * @summary List all provisioned users
    * @request GET:/api/v4/groups/{id}/provisioned_users
    */
    getApiV4GroupsIdProvisionedUsers: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/provisioned_users`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all SSH certificates for a specified group.
    *
    * @tags keys
    * @name GetApiV4GroupsIdSshCertificates
    * @summary Get a list of Groups::SshCertificate for a Group.
    * @request GET:/api/v4/groups/{id}/ssh_certificates
    */
    getApiV4GroupsIdSshCertificates: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/ssh_certificates`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds a group SSH certificate for a specified group.
    *
    * @tags keys
    * @name PostApiV4GroupsIdSshCertificates
    * @summary Add a Groups::SshCertificate.
    * @request POST:/api/v4/groups/{id}/ssh_certificates
    */
    postApiV4GroupsIdSshCertificates: (id, postApiV4GroupsIdSshCertificates, params = {}) => this.request({
      path: `/api/v4/groups/${id}/ssh_certificates`,
      method: "POST",
      body: postApiV4GroupsIdSshCertificates,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified group SSH certificate.
    *
    * @tags keys
    * @name DeleteApiV4GroupsIdSshCertificatesSshCertificatesId
    * @summary Delete a group SSH certificate
    * @request DELETE:/api/v4/groups/{id}/ssh_certificates/{ssh_certificates_id}
    */
    deleteApiV4GroupsIdSshCertificatesSshCertificatesId: (id, sshCertificatesId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/ssh_certificates/${sshCertificatesId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all runners available in a specified group and any ancestor groups, including any allowed instance runners.
    *
    * @tags runners, groups
    * @name GetApiV4GroupsIdRunners
    * @summary List all runners in a group
    * @request GET:/api/v4/groups/{id}/runners
    */
    getApiV4GroupsIdRunners: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/runners`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Resets the runner registration token for a specified group.
    *
    * @tags runners, groups
    * @name PostApiV4GroupsIdRunnersResetRegistrationToken
    * @summary Reset the runner registration token for a group
    * @request POST:/api/v4/groups/{id}/runners/reset_registration_token
    */
    postApiV4GroupsIdRunnersResetRegistrationToken: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/runners/reset_registration_token`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.5
    *
    * @tags packages_debian
    * @name GetApiV4GroupsIdPackagesDebianDistsDistributionReleaseGpg
    * @summary The Release file signature
    * @request GET:/api/v4/groups/{id}/-/packages/debian/dists/*distribution/Release.gpg
    */
    getApiV4GroupsIdPackagesDebianDistsDistributionReleaseGpg: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/debian/dists/*distribution/Release.gpg`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.5
    *
    * @tags packages_debian
    * @name GetApiV4GroupsIdPackagesDebianDistsDistributionRelease
    * @summary The unsigned Release file
    * @request GET:/api/v4/groups/{id}/-/packages/debian/dists/*distribution/Release
    */
    getApiV4GroupsIdPackagesDebianDistsDistributionRelease: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/debian/dists/*distribution/Release`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.5
    *
    * @tags packages_debian
    * @name GetApiV4GroupsIdPackagesDebianDistsDistributionInrelease
    * @summary The signed Release file
    * @request GET:/api/v4/groups/{id}/-/packages/debian/dists/*distribution/InRelease
    */
    getApiV4GroupsIdPackagesDebianDistsDistributionInrelease: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/debian/dists/*distribution/InRelease`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.4
    *
    * @tags packages_debian
    * @name GetApiV4GroupsIdPackagesDebianDistsDistributionComponentDebianInstallerBinaryArchitecturePackages
    * @summary The installer (udeb) binary files index
    * @request GET:/api/v4/groups/{id}/-/packages/debian/dists/*distribution/{component}/debian-installer/binary-{architecture}/Packages
    */
    getApiV4GroupsIdPackagesDebianDistsDistributionComponentDebianInstallerBinaryArchitecturePackages: (id, component, architecture, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/debian/dists/*distribution/${component}/debian-installer/binary-${architecture}/Packages`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.4
    *
    * @tags packages_debian
    * @name GetApiV4GroupsIdPackagesDebianDistsDistributionComponentDebianInstallerBinaryArchitectureByHashSha256FileSha256
    * @summary The installer (udeb) binary files index by hash
    * @request GET:/api/v4/groups/{id}/-/packages/debian/dists/*distribution/{component}/debian-installer/binary-{architecture}/by-hash/SHA256/{file_sha256}
    */
    getApiV4GroupsIdPackagesDebianDistsDistributionComponentDebianInstallerBinaryArchitectureByHashSha256FileSha256: (id, component, architecture, fileSha256, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/debian/dists/*distribution/${component}/debian-installer/binary-${architecture}/by-hash/SHA256/${fileSha256}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.4
    *
    * @tags packages_debian
    * @name GetApiV4GroupsIdPackagesDebianDistsDistributionComponentSourceSources
    * @summary The source files index
    * @request GET:/api/v4/groups/{id}/-/packages/debian/dists/*distribution/{component}/source/Sources
    */
    getApiV4GroupsIdPackagesDebianDistsDistributionComponentSourceSources: (id, component, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/debian/dists/*distribution/${component}/source/Sources`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.4
    *
    * @tags packages_debian
    * @name GetApiV4GroupsIdPackagesDebianDistsDistributionComponentSourceByHashSha256FileSha256
    * @summary The source files index by hash
    * @request GET:/api/v4/groups/{id}/-/packages/debian/dists/*distribution/{component}/source/by-hash/SHA256/{file_sha256}
    */
    getApiV4GroupsIdPackagesDebianDistsDistributionComponentSourceByHashSha256FileSha256: (id, component, fileSha256, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/debian/dists/*distribution/${component}/source/by-hash/SHA256/${fileSha256}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.5
    *
    * @tags packages_debian
    * @name GetApiV4GroupsIdPackagesDebianDistsDistributionComponentBinaryArchitecturePackages
    * @summary The binary files index
    * @request GET:/api/v4/groups/{id}/-/packages/debian/dists/*distribution/{component}/binary-{architecture}/Packages
    */
    getApiV4GroupsIdPackagesDebianDistsDistributionComponentBinaryArchitecturePackages: (id, component, architecture, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/debian/dists/*distribution/${component}/binary-${architecture}/Packages`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.4
    *
    * @tags packages_debian
    * @name GetApiV4GroupsIdPackagesDebianDistsDistributionComponentBinaryArchitectureByHashSha256FileSha256
    * @summary The binary files index by hash
    * @request GET:/api/v4/groups/{id}/-/packages/debian/dists/*distribution/{component}/binary-{architecture}/by-hash/SHA256/{file_sha256}
    */
    getApiV4GroupsIdPackagesDebianDistsDistributionComponentBinaryArchitectureByHashSha256FileSha256: (id, component, architecture, fileSha256, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/debian/dists/*distribution/${component}/binary-${architecture}/by-hash/SHA256/${fileSha256}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 14.2
    *
    * @tags packages_debian
    * @name GetApiV4GroupsIdPackagesDebianPoolDistributionProjectIdLetterPackageNamePackageVersionFileName
    * @summary Download Debian package
    * @request GET:/api/v4/groups/{id}/-/packages/debian/pool/{distribution}/{project_id}/{letter}/{package_name}/{package_version}/{file_name}
    */
    getApiV4GroupsIdPackagesDebianPoolDistributionProjectIdLetterPackageNamePackageVersionFileName: (id, projectId, distribution, letter, packageName, packageVersion, fileName, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/debian/pool/${distribution}/${projectId}/${letter}/${packageName}/${packageVersion}/${fileName}`,
      method: "GET",
      ...params
    }),
    /**
    * @description Purges the dependency proxy for a specified group and schedules the cached manifests and blobs for deletion. This endpoint requires the Owner role for the group.
    *
    * @tags dependency_proxy
    * @name DeleteApiV4GroupsIdDependencyProxyCache
    * @summary Purge the dependency proxy for a group
    * @request DELETE:/api/v4/groups/{id}/dependency_proxy/cache
    */
    deleteApiV4GroupsIdDependencyProxyCache: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/dependency_proxy/cache`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all group deploy tokens.
    *
    * @tags deploy_resources
    * @name GetApiV4GroupsIdDeployTokens
    * @summary List all group deploy tokens
    * @request GET:/api/v4/groups/{id}/deploy_tokens
    */
    getApiV4GroupsIdDeployTokens: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/deploy_tokens`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a group deploy token.
    *
    * @tags deploy_resources
    * @name PostApiV4GroupsIdDeployTokens
    * @summary Create a group deploy token
    * @request POST:/api/v4/groups/{id}/deploy_tokens
    */
    postApiV4GroupsIdDeployTokens: (id, postApiV4GroupsIdDeployTokens, params = {}) => this.request({
      path: `/api/v4/groups/${id}/deploy_tokens`,
      method: "POST",
      body: postApiV4GroupsIdDeployTokens,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Get a single group's deploy token by ID. This feature was introduced in GitLab 14.9. 
    *
    * @tags deploy_resources
    * @name GetApiV4GroupsIdDeployTokensTokenId
    * @summary Retrieve a group deploy token
    * @request GET:/api/v4/groups/{id}/deploy_tokens/{token_id}
    */
    getApiV4GroupsIdDeployTokensTokenId: (id, tokenId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/deploy_tokens/${tokenId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a group deploy token.
    *
    * @tags deploy_resources
    * @name DeleteApiV4GroupsIdDeployTokensTokenId
    * @summary Delete a group deploy token
    * @request DELETE:/api/v4/groups/{id}/deploy_tokens/{token_id}
    */
    deleteApiV4GroupsIdDeployTokensTokenId: (id, tokenId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/deploy_tokens/${tokenId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Downloads a group avatar image.
    *
    * @tags avatars
    * @name GetApiV4GroupsIdAvatar
    * @summary Download a group avatar
    * @request GET:/api/v4/groups/{id}/avatar
    */
    getApiV4GroupsIdAvatar: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/avatar`,
      method: "GET",
      ...params
    }),
    /**
    * @description Lists all group clusters for a specified group.
    *
    * @tags clusters
    * @name GetApiV4GroupsIdClusters
    * @summary List all group clusters
    * @request GET:/api/v4/groups/{id}/clusters
    */
    getApiV4GroupsIdClusters: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/clusters`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified group cluster.
    *
    * @tags clusters
    * @name GetApiV4GroupsIdClustersClusterId
    * @summary Retrieve a group cluster
    * @request GET:/api/v4/groups/{id}/clusters/{cluster_id}
    */
    getApiV4GroupsIdClustersClusterId: (id, clusterId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/clusters/${clusterId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified group cluster.
    *
    * @tags clusters
    * @name PutApiV4GroupsIdClustersClusterId
    * @summary Update a group cluster
    * @request PUT:/api/v4/groups/{id}/clusters/{cluster_id}
    */
    putApiV4GroupsIdClustersClusterId: (id, clusterId, putApiV4GroupsIdClustersClusterId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/clusters/${clusterId}`,
      method: "PUT",
      body: putApiV4GroupsIdClustersClusterId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified group cluster. Does not remove existing resources in the connected Kubernetes cluster.
    *
    * @tags clusters
    * @name DeleteApiV4GroupsIdClustersClusterId
    * @summary Delete a group cluster
    * @request DELETE:/api/v4/groups/{id}/clusters/{cluster_id}
    */
    deleteApiV4GroupsIdClustersClusterId: (id, clusterId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/clusters/${clusterId}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description Creates a group cluster for a specified group by adding an existing Kubernetes cluster.
    *
    * @tags clusters
    * @name PostApiV4GroupsIdClustersUser
    * @summary Create a group cluster
    * @request POST:/api/v4/groups/{id}/clusters/user
    */
    postApiV4GroupsIdClustersUser: (id, postApiV4GroupsIdClustersUser, params = {}) => this.request({
      path: `/api/v4/groups/${id}/clusters/user`,
      method: "POST",
      body: postApiV4GroupsIdClustersUser,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all registry repositories for a specified group.
    *
    * @tags container_registry
    * @name GetApiV4GroupsIdRegistryRepositories
    * @summary List all registry repositories for a group
    * @request GET:/api/v4/groups/{id}/registry/repositories
    */
    getApiV4GroupsIdRegistryRepositories: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/registry/repositories`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a Debian group distribution for a specified group.
    *
    * @tags packages_debian
    * @name PostApiV4GroupsIdDebianDistributions
    * @summary Create a Debian group distribution
    * @request POST:/api/v4/groups/{id}/-/debian_distributions
    */
    postApiV4GroupsIdDebianDistributions: (id, postApiV4GroupsIdDebianDistributions, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/debian_distributions`,
      method: "POST",
      body: postApiV4GroupsIdDebianDistributions,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all Debian distributions for a specified group.
    *
    * @tags packages_debian
    * @name GetApiV4GroupsIdDebianDistributions
    * @summary List all Debian group distributions
    * @request GET:/api/v4/groups/{id}/-/debian_distributions
    */
    getApiV4GroupsIdDebianDistributions: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/debian_distributions`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified Debian group distribution for a group.
    *
    * @tags packages_debian
    * @name GetApiV4GroupsIdDebianDistributionsCodename
    * @summary Retrieve a Debian group distribution
    * @request GET:/api/v4/groups/{id}/-/debian_distributions/{codename}
    */
    getApiV4GroupsIdDebianDistributionsCodename: (id, codename, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/debian_distributions/${codename}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified Debian group distribution for a group.
    *
    * @tags packages_debian
    * @name PutApiV4GroupsIdDebianDistributionsCodename
    * @summary Update a Debian group distribution
    * @request PUT:/api/v4/groups/{id}/-/debian_distributions/{codename}
    */
    putApiV4GroupsIdDebianDistributionsCodename: (id, codename, putApiV4GroupsIdDebianDistributionsCodename, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/debian_distributions/${codename}`,
      method: "PUT",
      body: putApiV4GroupsIdDebianDistributionsCodename,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified Debian group distribution for a group.
    *
    * @tags packages_debian
    * @name DeleteApiV4GroupsIdDebianDistributionsCodename
    * @summary Delete a Debian group distribution
    * @request DELETE:/api/v4/groups/{id}/-/debian_distributions/{codename}
    */
    deleteApiV4GroupsIdDebianDistributionsCodename: (id, codename, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/debian_distributions/${codename}`,
      method: "DELETE",
      query,
      ...params
    }),
    /**
    * @description Retrieves a specified Debian group distribution key for a group.
    *
    * @tags packages_debian
    * @name GetApiV4GroupsIdDebianDistributionsCodenameKeyAsc
    * @summary Retrieve a Debian group distribution key
    * @request GET:/api/v4/groups/{id}/-/debian_distributions/{codename}/key.asc
    */
    getApiV4GroupsIdDebianDistributionsCodenameKeyAsc: (id, codename, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/debian_distributions/${codename}/key.asc`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the exported archive for a specified group.
    *
    * @tags group_import_and_export
    * @name GetApiV4GroupsIdExportDownload
    * @summary Retrieve a group export download
    * @request GET:/api/v4/groups/{id}/export/download
    */
    getApiV4GroupsIdExportDownload: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/export/download`,
      method: "GET",
      ...params
    }),
    /**
    * @description Creates a group export for a specified group.
    *
    * @tags group_import_and_export
    * @name PostApiV4GroupsIdExport
    * @summary Create a group export
    * @request POST:/api/v4/groups/{id}/export
    */
    postApiV4GroupsIdExport: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/export`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Schedules a relations export for a specified group.
    *
    * @tags group_import_and_export
    * @name PostApiV4GroupsIdExportRelations
    * @summary Schedule a relations export for a group
    * @request POST:/api/v4/groups/{id}/export_relations
    */
    postApiV4GroupsIdExportRelations: (id, postApiV4GroupsIdExportRelations, params = {}) => this.request({
      path: `/api/v4/groups/${id}/export_relations`,
      method: "POST",
      body: postApiV4GroupsIdExportRelations,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Downloads a group relations export file.
    *
    * @tags group_import_and_export
    * @name GetApiV4GroupsIdExportRelationsDownload
    * @summary Download a relations export for a group
    * @request GET:/api/v4/groups/{id}/export_relations/download
    */
    getApiV4GroupsIdExportRelationsDownload: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/export_relations/download`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Retrieves the status of a relations export for a group.
    *
    * @tags group_import_and_export
    * @name GetApiV4GroupsIdExportRelationsStatus
    * @summary Retrieve the status of an relations export for a group
    * @request GET:/api/v4/groups/{id}/export_relations/status
    */
    getApiV4GroupsIdExportRelationsStatus: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/export_relations/status`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.8
    *
    * @tags group_import_and_export
    * @name PostApiV4GroupsImportAuthorize
    * @summary Workhorse authorize the group import upload
    * @request POST:/api/v4/groups/import/authorize
    */
    postApiV4GroupsImportAuthorize: (params = {}) => this.request({
      path: `/api/v4/groups/import/authorize`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Creates a group import. The maximum import file size can be set by the Administrator on GitLab Self-Managed (defaults to `0` (unlimited)).
    *
    * @tags group_import_and_export
    * @name PostApiV4GroupsImport
    * @summary Create a group import
    * @request POST:/api/v4/groups/import
    */
    postApiV4GroupsImport: (data, params = {}) => this.request({
      path: `/api/v4/groups/import`,
      method: "POST",
      body: data,
      type: "multipart/form-data" /* FormData */,
      ...params
    }),
    /**
    * @description Lists all packages for a specified group. When accessed without authentication, only packages of public projects are returned. By default, packages with `default`, `deprecated`, and `error` status are returned. Use the `status` parameter to view other packages.
    *
    * @tags packages
    * @name GetApiV4GroupsIdPackages
    * @summary List all packages for a group
    * @request GET:/api/v4/groups/{id}/packages
    */
    getApiV4GroupsIdPackages: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/packages`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a CSV file with a list of pending reassignments. This feature was introduced in GitLab 17.10.
    *
    * @tags groups
    * @name GetApiV4GroupsIdPlaceholderReassignments
    * @summary Retrieve pending reassignments
    * @request GET:/api/v4/groups/{id}/placeholder_reassignments
    */
    getApiV4GroupsIdPlaceholderReassignments: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/placeholder_reassignments`,
      method: "GET",
      ...params
    }),
    /**
    * @description Reassigns placeholder users with an uploaded CSV file.
    *
    * @tags groups
    * @name PostApiV4GroupsIdPlaceholderReassignments
    * @summary Reassign placeholders
    * @request POST:/api/v4/groups/{id}/placeholder_reassignments
    */
    postApiV4GroupsIdPlaceholderReassignments: (id, postApiV4GroupsIdPlaceholderReassignments, params = {}) => this.request({
      path: `/api/v4/groups/${id}/placeholder_reassignments`,
      method: "POST",
      body: postApiV4GroupsIdPlaceholderReassignments,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Authorizes Workhorse to handle CSV file uploads for placeholder reassignments. This feature was introduced in GitLab 17.10
    *
    * @tags groups
    * @name PostApiV4GroupsIdPlaceholderReassignmentsAuthorize
    * @summary Workhorse authorization for the reassignment CSV file
    * @request POST:/api/v4/groups/{id}/placeholder_reassignments/authorize
    */
    postApiV4GroupsIdPlaceholderReassignmentsAuthorize: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/placeholder_reassignments/authorize`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all variables for a specified group. Use the `page` and `per_page` pagination parameters to control the pagination of results.
    *
    * @tags ci_variables
    * @name GetApiV4GroupsIdVariables
    * @summary List all group variables
    * @request GET:/api/v4/groups/{id}/variables
    */
    getApiV4GroupsIdVariables: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/variables`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a group variable.
    *
    * @tags ci_variables
    * @name PostApiV4GroupsIdVariables
    * @summary Create a group variable
    * @request POST:/api/v4/groups/{id}/variables
    */
    postApiV4GroupsIdVariables: (id, postApiV4GroupsIdVariables, params = {}) => this.request({
      path: `/api/v4/groups/${id}/variables`,
      method: "POST",
      body: postApiV4GroupsIdVariables,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves details of a specified group variable. If there are multiple variables with the same key, use `filter` to select the correct `environment_scope`.
    *
    * @tags ci_variables
    * @name GetApiV4GroupsIdVariablesKey
    * @summary Retrieve details of a group variable
    * @request GET:/api/v4/groups/{id}/variables/{key}
    */
    getApiV4GroupsIdVariablesKey: (id, key, params = {}) => this.request({
      path: `/api/v4/groups/${id}/variables/${key}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified group variable. If there are multiple variables with the same key, use `filter` to select the correct `environment_scope`.
    *
    * @tags ci_variables
    * @name PutApiV4GroupsIdVariablesKey
    * @summary Update a group variable
    * @request PUT:/api/v4/groups/{id}/variables/{key}
    */
    putApiV4GroupsIdVariablesKey: (id, key, putApiV4GroupsIdVariablesKey, params = {}) => this.request({
      path: `/api/v4/groups/${id}/variables/${key}`,
      method: "PUT",
      body: putApiV4GroupsIdVariablesKey,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified group variable. If there are multiple variables with the same key, use `filter` to select the correct `environment_scope`.
    *
    * @tags ci_variables
    * @name DeleteApiV4GroupsIdVariablesKey
    * @summary Delete a group variable
    * @request DELETE:/api/v4/groups/{id}/variables/{key}
    */
    deleteApiV4GroupsIdVariablesKey: (id, key, params = {}) => this.request({
      path: `/api/v4/groups/${id}/variables/${key}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all active integrations.
    *
    * @tags integrations
    * @name GetApiV4GroupsIdIntegrations
    * @summary List all active integrations
    * @request GET:/api/v4/groups/{id}/integrations
    */
    getApiV4GroupsIdIntegrations: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Apple App Store integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsAppleAppStore
    * @summary Create or update the Apple App Store integration
    * @request PUT:/api/v4/groups/{id}/integrations/apple-app-store
    */
    putApiV4GroupsIdIntegrationsAppleAppStore: (id, putApiV4GroupsIdIntegrationsAppleAppStore, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/apple-app-store`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsAppleAppStore,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Asana integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsAsana
    * @summary Create or update the Asana integration
    * @request PUT:/api/v4/groups/{id}/integrations/asana
    */
    putApiV4GroupsIdIntegrationsAsana: (id, putApiV4GroupsIdIntegrationsAsana, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/asana`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsAsana,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Assembla integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsAssembla
    * @summary Create or update the Assembla integration
    * @request PUT:/api/v4/groups/{id}/integrations/assembla
    */
    putApiV4GroupsIdIntegrationsAssembla: (id, putApiV4GroupsIdIntegrationsAssembla, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/assembla`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsAssembla,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Bamboo integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsBamboo
    * @summary Create or update the Bamboo integration
    * @request PUT:/api/v4/groups/{id}/integrations/bamboo
    */
    putApiV4GroupsIdIntegrationsBamboo: (id, putApiV4GroupsIdIntegrationsBamboo, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/bamboo`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsBamboo,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Bugzilla integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsBugzilla
    * @summary Create or update the Bugzilla integration
    * @request PUT:/api/v4/groups/{id}/integrations/bugzilla
    */
    putApiV4GroupsIdIntegrationsBugzilla: (id, putApiV4GroupsIdIntegrationsBugzilla, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/bugzilla`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsBugzilla,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Buildkite integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsBuildkite
    * @summary Create or update the Buildkite integration
    * @request PUT:/api/v4/groups/{id}/integrations/buildkite
    */
    putApiV4GroupsIdIntegrationsBuildkite: (id, putApiV4GroupsIdIntegrationsBuildkite, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/buildkite`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsBuildkite,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Campfire integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsCampfire
    * @summary Create or update the Campfire integration
    * @request PUT:/api/v4/groups/{id}/integrations/campfire
    */
    putApiV4GroupsIdIntegrationsCampfire: (id, putApiV4GroupsIdIntegrationsCampfire, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/campfire`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsCampfire,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Confluence integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsConfluence
    * @summary Create or update the Confluence integration
    * @request PUT:/api/v4/groups/{id}/integrations/confluence
    */
    putApiV4GroupsIdIntegrationsConfluence: (id, putApiV4GroupsIdIntegrationsConfluence, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/confluence`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsConfluence,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Custom Issue Tracker integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsCustomIssueTracker
    * @summary Create or update the Custom Issue Tracker integration
    * @request PUT:/api/v4/groups/{id}/integrations/custom-issue-tracker
    */
    putApiV4GroupsIdIntegrationsCustomIssueTracker: (id, putApiV4GroupsIdIntegrationsCustomIssueTracker, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/custom-issue-tracker`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsCustomIssueTracker,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Datadog integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsDatadog
    * @summary Create or update the Datadog integration
    * @request PUT:/api/v4/groups/{id}/integrations/datadog
    */
    putApiV4GroupsIdIntegrationsDatadog: (id, putApiV4GroupsIdIntegrationsDatadog, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/datadog`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsDatadog,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Diffblue Cover integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsDiffblueCover
    * @summary Create or update the Diffblue Cover integration
    * @request PUT:/api/v4/groups/{id}/integrations/diffblue-cover
    */
    putApiV4GroupsIdIntegrationsDiffblueCover: (id, putApiV4GroupsIdIntegrationsDiffblueCover, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/diffblue-cover`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsDiffblueCover,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Discord integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsDiscord
    * @summary Create or update the Discord integration
    * @request PUT:/api/v4/groups/{id}/integrations/discord
    */
    putApiV4GroupsIdIntegrationsDiscord: (id, putApiV4GroupsIdIntegrationsDiscord, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/discord`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsDiscord,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Drone Ci integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsDroneCi
    * @summary Create or update the Drone Ci integration
    * @request PUT:/api/v4/groups/{id}/integrations/drone-ci
    */
    putApiV4GroupsIdIntegrationsDroneCi: (id, putApiV4GroupsIdIntegrationsDroneCi, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/drone-ci`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsDroneCi,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Emails On Push integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsEmailsOnPush
    * @summary Create or update the Emails On Push integration
    * @request PUT:/api/v4/groups/{id}/integrations/emails-on-push
    */
    putApiV4GroupsIdIntegrationsEmailsOnPush: (id, putApiV4GroupsIdIntegrationsEmailsOnPush, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/emails-on-push`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsEmailsOnPush,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the External Wiki integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsExternalWiki
    * @summary Create or update the External Wiki integration
    * @request PUT:/api/v4/groups/{id}/integrations/external-wiki
    */
    putApiV4GroupsIdIntegrationsExternalWiki: (id, putApiV4GroupsIdIntegrationsExternalWiki, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/external-wiki`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsExternalWiki,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Gitlab Slack Application integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsGitlabSlackApplication
    * @summary Create or update the Gitlab Slack Application integration
    * @request PUT:/api/v4/groups/{id}/integrations/gitlab-slack-application
    */
    putApiV4GroupsIdIntegrationsGitlabSlackApplication: (id, putApiV4GroupsIdIntegrationsGitlabSlackApplication, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/gitlab-slack-application`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsGitlabSlackApplication,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Google Play integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsGooglePlay
    * @summary Create or update the Google Play integration
    * @request PUT:/api/v4/groups/{id}/integrations/google-play
    */
    putApiV4GroupsIdIntegrationsGooglePlay: (id, putApiV4GroupsIdIntegrationsGooglePlay, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/google-play`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsGooglePlay,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Hangouts Chat integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsHangoutsChat
    * @summary Create or update the Hangouts Chat integration
    * @request PUT:/api/v4/groups/{id}/integrations/hangouts-chat
    */
    putApiV4GroupsIdIntegrationsHangoutsChat: (id, putApiV4GroupsIdIntegrationsHangoutsChat, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/hangouts-chat`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsHangoutsChat,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Harbor integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsHarbor
    * @summary Create or update the Harbor integration
    * @request PUT:/api/v4/groups/{id}/integrations/harbor
    */
    putApiV4GroupsIdIntegrationsHarbor: (id, putApiV4GroupsIdIntegrationsHarbor, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/harbor`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsHarbor,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Irker integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsIrker
    * @summary Create or update the Irker integration
    * @request PUT:/api/v4/groups/{id}/integrations/irker
    */
    putApiV4GroupsIdIntegrationsIrker: (id, putApiV4GroupsIdIntegrationsIrker, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/irker`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsIrker,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Jenkins integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsJenkins
    * @summary Create or update the Jenkins integration
    * @request PUT:/api/v4/groups/{id}/integrations/jenkins
    */
    putApiV4GroupsIdIntegrationsJenkins: (id, putApiV4GroupsIdIntegrationsJenkins, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/jenkins`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsJenkins,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Jira integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsJira
    * @summary Create or update the Jira integration
    * @request PUT:/api/v4/groups/{id}/integrations/jira
    */
    putApiV4GroupsIdIntegrationsJira: (id, putApiV4GroupsIdIntegrationsJira, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/jira`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsJira,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Jira Cloud App integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsJiraCloudApp
    * @summary Create or update the Jira Cloud App integration
    * @request PUT:/api/v4/groups/{id}/integrations/jira-cloud-app
    */
    putApiV4GroupsIdIntegrationsJiraCloudApp: (id, putApiV4GroupsIdIntegrationsJiraCloudApp, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/jira-cloud-app`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsJiraCloudApp,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Linear integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsLinear
    * @summary Create or update the Linear integration
    * @request PUT:/api/v4/groups/{id}/integrations/linear
    */
    putApiV4GroupsIdIntegrationsLinear: (id, putApiV4GroupsIdIntegrationsLinear, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/linear`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsLinear,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Matrix integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsMatrix
    * @summary Create or update the Matrix integration
    * @request PUT:/api/v4/groups/{id}/integrations/matrix
    */
    putApiV4GroupsIdIntegrationsMatrix: (id, putApiV4GroupsIdIntegrationsMatrix, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/matrix`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsMatrix,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Mattermost Slash Commands integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsMattermostSlashCommands
    * @summary Create or update the Mattermost Slash Commands integration
    * @request PUT:/api/v4/groups/{id}/integrations/mattermost-slash-commands
    */
    putApiV4GroupsIdIntegrationsMattermostSlashCommands: (id, putApiV4GroupsIdIntegrationsMattermostSlashCommands, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/mattermost-slash-commands`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsMattermostSlashCommands,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Packagist integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsPackagist
    * @summary Create or update the Packagist integration
    * @request PUT:/api/v4/groups/{id}/integrations/packagist
    */
    putApiV4GroupsIdIntegrationsPackagist: (id, putApiV4GroupsIdIntegrationsPackagist, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/packagist`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsPackagist,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Phorge integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsPhorge
    * @summary Create or update the Phorge integration
    * @request PUT:/api/v4/groups/{id}/integrations/phorge
    */
    putApiV4GroupsIdIntegrationsPhorge: (id, putApiV4GroupsIdIntegrationsPhorge, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/phorge`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsPhorge,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Pipelines Email integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsPipelinesEmail
    * @summary Create or update the Pipelines Email integration
    * @request PUT:/api/v4/groups/{id}/integrations/pipelines-email
    */
    putApiV4GroupsIdIntegrationsPipelinesEmail: (id, putApiV4GroupsIdIntegrationsPipelinesEmail, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/pipelines-email`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsPipelinesEmail,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Pivotaltracker integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsPivotaltracker
    * @summary Create or update the Pivotaltracker integration
    * @request PUT:/api/v4/groups/{id}/integrations/pivotaltracker
    */
    putApiV4GroupsIdIntegrationsPivotaltracker: (id, putApiV4GroupsIdIntegrationsPivotaltracker, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/pivotaltracker`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsPivotaltracker,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Pumble integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsPumble
    * @summary Create or update the Pumble integration
    * @request PUT:/api/v4/groups/{id}/integrations/pumble
    */
    putApiV4GroupsIdIntegrationsPumble: (id, putApiV4GroupsIdIntegrationsPumble, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/pumble`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsPumble,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Pushover integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsPushover
    * @summary Create or update the Pushover integration
    * @request PUT:/api/v4/groups/{id}/integrations/pushover
    */
    putApiV4GroupsIdIntegrationsPushover: (id, putApiV4GroupsIdIntegrationsPushover, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/pushover`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsPushover,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Redmine integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsRedmine
    * @summary Create or update the Redmine integration
    * @request PUT:/api/v4/groups/{id}/integrations/redmine
    */
    putApiV4GroupsIdIntegrationsRedmine: (id, putApiV4GroupsIdIntegrationsRedmine, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/redmine`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsRedmine,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Ewm integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsEwm
    * @summary Create or update the Ewm integration
    * @request PUT:/api/v4/groups/{id}/integrations/ewm
    */
    putApiV4GroupsIdIntegrationsEwm: (id, putApiV4GroupsIdIntegrationsEwm, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/ewm`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsEwm,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Youtrack integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsYoutrack
    * @summary Create or update the Youtrack integration
    * @request PUT:/api/v4/groups/{id}/integrations/youtrack
    */
    putApiV4GroupsIdIntegrationsYoutrack: (id, putApiV4GroupsIdIntegrationsYoutrack, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/youtrack`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsYoutrack,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Clickup integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsClickup
    * @summary Create or update the Clickup integration
    * @request PUT:/api/v4/groups/{id}/integrations/clickup
    */
    putApiV4GroupsIdIntegrationsClickup: (id, putApiV4GroupsIdIntegrationsClickup, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/clickup`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsClickup,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Slack integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsSlack
    * @summary Create or update the Slack integration
    * @request PUT:/api/v4/groups/{id}/integrations/slack
    */
    putApiV4GroupsIdIntegrationsSlack: (id, putApiV4GroupsIdIntegrationsSlack, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/slack`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsSlack,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Microsoft Teams integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsMicrosoftTeams
    * @summary Create or update the Microsoft Teams integration
    * @request PUT:/api/v4/groups/{id}/integrations/microsoft-teams
    */
    putApiV4GroupsIdIntegrationsMicrosoftTeams: (id, putApiV4GroupsIdIntegrationsMicrosoftTeams, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/microsoft-teams`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsMicrosoftTeams,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Mattermost integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsMattermost
    * @summary Create or update the Mattermost integration
    * @request PUT:/api/v4/groups/{id}/integrations/mattermost
    */
    putApiV4GroupsIdIntegrationsMattermost: (id, putApiV4GroupsIdIntegrationsMattermost, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/mattermost`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsMattermost,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Teamcity integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsTeamcity
    * @summary Create or update the Teamcity integration
    * @request PUT:/api/v4/groups/{id}/integrations/teamcity
    */
    putApiV4GroupsIdIntegrationsTeamcity: (id, putApiV4GroupsIdIntegrationsTeamcity, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/teamcity`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsTeamcity,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Telegram integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsTelegram
    * @summary Create or update the Telegram integration
    * @request PUT:/api/v4/groups/{id}/integrations/telegram
    */
    putApiV4GroupsIdIntegrationsTelegram: (id, putApiV4GroupsIdIntegrationsTelegram, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/telegram`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsTelegram,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Unify Circuit integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsUnifyCircuit
    * @summary Create or update the Unify Circuit integration
    * @request PUT:/api/v4/groups/{id}/integrations/unify-circuit
    */
    putApiV4GroupsIdIntegrationsUnifyCircuit: (id, putApiV4GroupsIdIntegrationsUnifyCircuit, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/unify-circuit`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsUnifyCircuit,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Webex Teams integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsWebexTeams
    * @summary Create or update the Webex Teams integration
    * @request PUT:/api/v4/groups/{id}/integrations/webex-teams
    */
    putApiV4GroupsIdIntegrationsWebexTeams: (id, putApiV4GroupsIdIntegrationsWebexTeams, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/webex-teams`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsWebexTeams,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Zentao integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsZentao
    * @summary Create or update the Zentao integration
    * @request PUT:/api/v4/groups/{id}/integrations/zentao
    */
    putApiV4GroupsIdIntegrationsZentao: (id, putApiV4GroupsIdIntegrationsZentao, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/zentao`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsZentao,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Squash Tm integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsSquashTm
    * @summary Create or update the Squash Tm integration
    * @request PUT:/api/v4/groups/{id}/integrations/squash-tm
    */
    putApiV4GroupsIdIntegrationsSquashTm: (id, putApiV4GroupsIdIntegrationsSquashTm, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/squash-tm`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsSquashTm,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Github integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsGithub
    * @summary Create or update the Github integration
    * @request PUT:/api/v4/groups/{id}/integrations/github
    */
    putApiV4GroupsIdIntegrationsGithub: (id, putApiV4GroupsIdIntegrationsGithub, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/github`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsGithub,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Git Guardian integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsGitGuardian
    * @summary Create or update the Git Guardian integration
    * @request PUT:/api/v4/groups/{id}/integrations/git-guardian
    */
    putApiV4GroupsIdIntegrationsGitGuardian: (id, putApiV4GroupsIdIntegrationsGitGuardian, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/git-guardian`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsGitGuardian,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Google Cloud Platform Artifact Registry integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsGoogleCloudPlatformArtifactRegistry
    * @summary Create or update the Google Cloud Platform Artifact Registry integration
    * @request PUT:/api/v4/groups/{id}/integrations/google-cloud-platform-artifact-registry
    */
    putApiV4GroupsIdIntegrationsGoogleCloudPlatformArtifactRegistry: (id, putApiV4GroupsIdIntegrationsGoogleCloudPlatformArtifactRegistry, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/google-cloud-platform-artifact-registry`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsGoogleCloudPlatformArtifactRegistry,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Google Cloud Platform Workload Identity Federation integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsGoogleCloudPlatformWorkloadIdentityFederation
    * @summary Create or update the Google Cloud Platform Workload Identity Federation integration
    * @request PUT:/api/v4/groups/{id}/integrations/google-cloud-platform-workload-identity-federation
    */
    putApiV4GroupsIdIntegrationsGoogleCloudPlatformWorkloadIdentityFederation: (id, putApiV4GroupsIdIntegrationsGoogleCloudPlatformWorkloadIdentityFederation, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/google-cloud-platform-workload-identity-federation`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsGoogleCloudPlatformWorkloadIdentityFederation,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Mock Ci integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsMockCi
    * @summary Create or update the Mock Ci integration
    * @request PUT:/api/v4/groups/{id}/integrations/mock-ci
    */
    putApiV4GroupsIdIntegrationsMockCi: (id, putApiV4GroupsIdIntegrationsMockCi, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/mock-ci`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsMockCi,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Mock Monitoring integration.
    *
    * @tags integrations
    * @name PutApiV4GroupsIdIntegrationsMockMonitoring
    * @summary Create or update the Mock Monitoring integration
    * @request PUT:/api/v4/groups/{id}/integrations/mock-monitoring
    */
    putApiV4GroupsIdIntegrationsMockMonitoring: (id, putApiV4GroupsIdIntegrationsMockMonitoring, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/mock-monitoring`,
      method: "PUT",
      body: putApiV4GroupsIdIntegrationsMockMonitoring,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Disables a specified integration. Integration settings are preserved.
    *
    * @tags integrations
    * @name DeleteApiV4GroupsIdIntegrationsSlug
    * @summary Disable an integration
    * @request DELETE:/api/v4/groups/{id}/integrations/{slug}
    */
    deleteApiV4GroupsIdIntegrationsSlug: (slug, id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/${slug}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Retrieves the settings for a specified integration.
    *
    * @tags integrations
    * @name GetApiV4GroupsIdIntegrationsSlug
    * @summary Retrieve integration settings
    * @request GET:/api/v4/groups/{id}/integrations/{slug}
    */
    getApiV4GroupsIdIntegrationsSlug: (slug, id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/integrations/${slug}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Adds a member to a group. You can specify a user ID or invite a user by email.
    *
    * @tags invitations
    * @name PostApiV4GroupsIdInvitations
    * @summary Add a member to a group
    * @request POST:/api/v4/groups/{id}/invitations
    */
    postApiV4GroupsIdInvitations: (id, postApiV4GroupsIdInvitations, params = {}) => this.request({
      path: `/api/v4/groups/${id}/invitations`,
      method: "POST",
      body: postApiV4GroupsIdInvitations,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all pending invitations for a specified group viewable by the authenticated user. Returns invitations to direct members only, and not through inherited ancestor groups. This function takes pagination parameters `page` and `per_page` to restrict the list of members.
    *
    * @tags invitations
    * @name GetApiV4GroupsIdInvitations
    * @summary List all pending invitations for a group
    * @request GET:/api/v4/groups/{id}/invitations
    */
    getApiV4GroupsIdInvitations: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/invitations`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Updates a pending invitation to a group.
    *
    * @tags invitations
    * @name PutApiV4GroupsIdInvitationsEmail
    * @summary Update an invitation to a group
    * @request PUT:/api/v4/groups/{id}/invitations/{email}
    */
    putApiV4GroupsIdInvitationsEmail: (id, email, putApiV4GroupsIdInvitationsEmail, params = {}) => this.request({
      path: `/api/v4/groups/${id}/invitations/${email}`,
      method: "PUT",
      body: putApiV4GroupsIdInvitationsEmail,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a pending invitation to a specified email address for a group.
    *
    * @tags invitations
    * @name DeleteApiV4GroupsIdInvitationsEmail
    * @summary Delete an invitation to a group
    * @request DELETE:/api/v4/groups/{id}/invitations/{email}
    */
    deleteApiV4GroupsIdInvitationsEmail: (id, email, params = {}) => this.request({
      path: `/api/v4/groups/${id}/invitations/${email}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all issues for a specified group. If the group is private, you must provide credentials to authorize. In most cases, you should authenticate with a personal access token.
    *
    * @tags groups
    * @name GetApiV4GroupsIdIssues
    * @summary List all issues for a group
    * @request GET:/api/v4/groups/{id}/issues
    */
    getApiV4GroupsIdIssues: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/issues`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves statistics for issues in a specified group.
    *
    * @tags groups
    * @name GetApiV4GroupsIdIssuesStatistics
    * @summary Retrieve issues statistics for a group
    * @request GET:/api/v4/groups/{id}/issues_statistics
    */
    getApiV4GroupsIdIssuesStatistics: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/issues_statistics`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 19.0
    *
    * @tags groups
    * @name PostApiV4GroupsIdUploadsAuthorize
    * @summary Workhorse authorize the file upload
    * @request POST:/api/v4/groups/{id}/uploads/authorize
    */
    postApiV4GroupsIdUploadsAuthorize: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/uploads/authorize`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Uploads a file to the specified group. Returns a markdown-formatted link to the file.
    *
    * @tags groups
    * @name PostApiV4GroupsIdUploads
    * @summary Upload a file to a group
    * @request POST:/api/v4/groups/{id}/uploads
    */
    postApiV4GroupsIdUploads: (id, postApiV4GroupsIdUploads, params = {}) => this.request({
      path: `/api/v4/groups/${id}/uploads`,
      method: "POST",
      body: postApiV4GroupsIdUploads,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all uploads for a specified group sorted by `created_at` in descending order. You must have the Maintainer or Owner role for the group.
    *
    * @tags groups
    * @name GetApiV4GroupsIdUploads
    * @summary List all uploads for a group
    * @request GET:/api/v4/groups/{id}/uploads
    */
    getApiV4GroupsIdUploads: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/uploads`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Downloads an uploaded file with a specified ID. You must have the Maintainer or Owner role for the group.
    *
    * @tags groups
    * @name GetApiV4GroupsIdUploadsUploadId
    * @summary Download an uploaded file by ID
    * @request GET:/api/v4/groups/{id}/uploads/{upload_id}
    */
    getApiV4GroupsIdUploadsUploadId: (id, uploadId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/uploads/${uploadId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes an uploaded file with a specified ID. You must have the Maintainer or Owner role for the group.
    *
    * @tags groups
    * @name DeleteApiV4GroupsIdUploadsUploadId
    * @summary Delete an uploaded file by ID
    * @request DELETE:/api/v4/groups/{id}/uploads/{upload_id}
    */
    deleteApiV4GroupsIdUploadsUploadId: (id, uploadId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/uploads/${uploadId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Downloads an uploaded file with a specified secret and filename. You must have the Guest, Planner, Reporter, Developer, Maintainer, or Owner role for the group.
    *
    * @tags groups
    * @name GetApiV4GroupsIdUploadsSecretFilename
    * @summary Download an uploaded file by secret and filename
    * @request GET:/api/v4/groups/{id}/uploads/{secret}/{filename}
    */
    getApiV4GroupsIdUploadsSecretFilename: (id, secret, filename, params = {}) => this.request({
      path: `/api/v4/groups/${id}/uploads/${secret}/${filename}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes an uploaded file with a specified secret and filename. You must have the Maintainer or Owner role for the group.
    *
    * @tags groups
    * @name DeleteApiV4GroupsIdUploadsSecretFilename
    * @summary Delete an uploaded file by secret and filename
    * @request DELETE:/api/v4/groups/{id}/uploads/{secret}/{filename}
    */
    deleteApiV4GroupsIdUploadsSecretFilename: (id, secret, filename, params = {}) => this.request({
      path: `/api/v4/groups/${id}/uploads/${secret}/${filename}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 11.7
    *
    * @tags packages
    * @name GetApiV4GroupsIdPackagesMavenPathFileName
    * @summary Download the maven package file at a group level
    * @request GET:/api/v4/groups/{id}/-/packages/maven/*path/{file_name}
    */
    getApiV4GroupsIdPackagesMavenPathFileName: (id, fileName, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/maven/*path/${fileName}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Lists all direct members of a specified group viewable by the authenticated user. Does not return inherited members from ancestor groups or invited groups.
    *
    * @tags members
    * @name GetApiV4GroupsIdMembers
    * @summary List all direct members of a group
    * @request GET:/api/v4/groups/{id}/members
    */
    getApiV4GroupsIdMembers: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/members`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds a member to a specified group.
    *
    * @tags members
    * @name PostApiV4GroupsIdMembers
    * @summary Add a member to a group
    * @request POST:/api/v4/groups/{id}/members
    */
    postApiV4GroupsIdMembers: (id, postApiV4GroupsIdMembers, params = {}) => this.request({
      path: `/api/v4/groups/${id}/members`,
      method: "POST",
      body: postApiV4GroupsIdMembers,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all members of a specified group viewable by the authenticated user. Also returns inherited members from ancestor groups or invited groups. If a user is a member of this group and one or more ancestor groups, only returns the highest `access_level`. Members from an invited group are returned if the invited group is public, the requester is a member of an invited group, or the requester is a member of the shared group or project.
    *
    * @tags members
    * @name GetApiV4GroupsIdMembersAll
    * @summary List all members of a group
    * @request GET:/api/v4/groups/{id}/members/all
    */
    getApiV4GroupsIdMembersAll: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/members/all`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified member of a group. Returns only direct members and not inherited members through ancestor groups.
    *
    * @tags members
    * @name GetApiV4GroupsIdMembersUserId
    * @summary Retrieve a direct group member
    * @request GET:/api/v4/groups/{id}/members/{user_id}
    */
    getApiV4GroupsIdMembersUserId: (id, userId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/members/${userId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified member of a group.
    *
    * @tags members
    * @name PutApiV4GroupsIdMembersUserId
    * @summary Update a group member
    * @request PUT:/api/v4/groups/{id}/members/{user_id}
    */
    putApiV4GroupsIdMembersUserId: (id, userId, putApiV4GroupsIdMembersUserId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/members/${userId}`,
      method: "PUT",
      body: putApiV4GroupsIdMembersUserId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Removes a specified user from a group. The user must be a direct member.
    *
    * @tags members
    * @name DeleteApiV4GroupsIdMembersUserId
    * @summary Remove a member from a group
    * @request DELETE:/api/v4/groups/{id}/members/{user_id}
    */
    deleteApiV4GroupsIdMembersUserId: (id, userId, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/members/${userId}`,
      method: "DELETE",
      query,
      ...params
    }),
    /**
    * @description Retrieves a specified member of a group. Returns direct members and members inherited or invited through ancestor groups.
    *
    * @tags members
    * @name GetApiV4GroupsIdMembersAllUserId
    * @summary Retrieve a group member
    * @request GET:/api/v4/groups/{id}/members/all/{user_id}
    */
    getApiV4GroupsIdMembersAllUserId: (id, userId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/members/all/${userId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Sets the override flag for a member of a group. By default, the access level of LDAP group members is set to the value specified by LDAP through Group Sync.
    *
    * @tags members
    * @name PostApiV4GroupsIdMembersUserIdOverride
    * @summary Set override flag for a member of a group
    * @request POST:/api/v4/groups/{id}/members/{user_id}/override
    */
    postApiV4GroupsIdMembersUserIdOverride: (id, userId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/members/${userId}/override`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Removes an LDAP access level override for a member of a group.
    *
    * @tags members
    * @name DeleteApiV4GroupsIdMembersUserIdOverride
    * @summary Remove an LDAP access level override
    * @request DELETE:/api/v4/groups/{id}/members/{user_id}/override
    */
    deleteApiV4GroupsIdMembersUserIdOverride: (id, userId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/members/${userId}/override`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description Approves a specified pending user for a top-level group and any subgroups or projects.
    *
    * @tags members
    * @name PutApiV4GroupsIdMembersMemberIdApprove
    * @summary Approve a group member
    * @request PUT:/api/v4/groups/{id}/members/{member_id}/approve
    */
    putApiV4GroupsIdMembersMemberIdApprove: (id, memberId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/members/${memberId}/approve`,
      method: "PUT",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Approves all pending users for a specified top-level group and any subgroups or projects.
    *
    * @tags members
    * @name PostApiV4GroupsIdMembersApproveAll
    * @summary Approve all pending group members
    * @request POST:/api/v4/groups/{id}/members/approve_all
    */
    postApiV4GroupsIdMembersApproveAll: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/members/approve_all`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all members in an `awaiting` state and those who are invited but do not have a GitLab account for a specified group and any subgroups and projects. This operation works on top-level groups only. It does not work on subgroups.
    *
    * @tags members
    * @name GetApiV4GroupsIdPendingMembers
    * @summary List all pending group members
    * @request GET:/api/v4/groups/{id}/pending_members
    */
    getApiV4GroupsIdPendingMembers: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/pending_members`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Lists all billable members of a specified top-level group. Includes members in any subgroups or projects. You must have the Owner role for the group.
    *
    * @tags groups
    * @name GetApiV4GroupsIdBillableMembers
    * @summary List all billable group members
    * @request GET:/api/v4/groups/{id}/billable_members
    */
    getApiV4GroupsIdBillableMembers: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/billable_members`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Updates the membership state for a specified user in a group.
    *
    * @tags members
    * @name PutApiV4GroupsIdMembersUserIdState
    * @summary Update group membership state for a user
    * @request PUT:/api/v4/groups/{id}/members/{user_id}/state
    */
    putApiV4GroupsIdMembersUserIdState: (id, userId, putApiV4GroupsIdMembersUserIdState, params = {}) => this.request({
      path: `/api/v4/groups/${id}/members/${userId}/state`,
      method: "PUT",
      body: putApiV4GroupsIdMembersUserIdState,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all memberships for a specified billable member of a group. The response represents only direct memberships. Inherited memberships are not included.
    *
    * @tags members
    * @name GetApiV4GroupsIdBillableMembersUserIdMemberships
    * @summary List all memberships for a billable group member
    * @request GET:/api/v4/groups/{id}/billable_members/{user_id}/memberships
    */
    getApiV4GroupsIdBillableMembersUserIdMemberships: (id, userId, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/billable_members/${userId}/memberships`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all indirect memberships for a billable member of a group. This operation works on top-level groups only. It does not work on subgroups.
    *
    * @tags members
    * @name GetApiV4GroupsIdBillableMembersUserIdIndirect
    * @summary List all indirect memberships for a billable group member
    * @request GET:/api/v4/groups/{id}/billable_members/{user_id}/indirect
    */
    getApiV4GroupsIdBillableMembersUserIdIndirect: (id, userId, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/billable_members/${userId}/indirect`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Removes a specified billable member from a group and its subgroups and projects. The user does not need to be a group member to qualify for removal. For example, if the user was added directly to a project in the group, you can still remove them using this operation.
    *
    * @tags members
    * @name DeleteApiV4GroupsIdBillableMembersUserId
    * @summary Remove a billable member from a group
    * @request DELETE:/api/v4/groups/{id}/billable_members/{user_id}
    */
    deleteApiV4GroupsIdBillableMembersUserId: (id, userId, params = {}) => this.request({
      path: `/api/v4/groups/${id}/billable_members/${userId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all merge requests for a specified group and any subgroups.
    *
    * @tags merge_requests
    * @name GetApiV4GroupsIdMergeRequests
    * @summary List all group merge requests
    * @request GET:/api/v4/groups/{id}/merge_requests
    */
    getApiV4GroupsIdMergeRequests: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/merge_requests`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.7
    *
    * @tags packages_npm
    * @name GetApiV4GroupsIdPackagesNpmPackagePackageNameDistTags
    * @summary Get all tags for a given an NPM package
    * @request GET:/api/v4/groups/{id}/-/packages/npm/-/package/*package_name/dist-tags
    */
    getApiV4GroupsIdPackagesNpmPackagePackageNameDistTags: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/npm/-/package/*package_name/dist-tags`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.7
    *
    * @tags packages_npm
    * @name PutApiV4GroupsIdPackagesNpmPackagePackageNameDistTagsTag
    * @summary Create or Update the given tag for the given NPM package and version
    * @request PUT:/api/v4/groups/{id}/-/packages/npm/-/package/*package_name/dist-tags/{tag}
    */
    putApiV4GroupsIdPackagesNpmPackagePackageNameDistTagsTag: (id, tag, putApiV4GroupsIdPackagesNpmPackagepackageNameDistTagsTag, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/npm/-/package/*package_name/dist-tags/${tag}`,
      method: "PUT",
      body: putApiV4GroupsIdPackagesNpmPackagepackageNameDistTagsTag,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.7
    *
    * @tags packages_npm
    * @name DeleteApiV4GroupsIdPackagesNpmPackagePackageNameDistTagsTag
    * @summary Deletes the given tag
    * @request DELETE:/api/v4/groups/{id}/-/packages/npm/-/package/*package_name/dist-tags/{tag}
    */
    deleteApiV4GroupsIdPackagesNpmPackagePackageNameDistTagsTag: (id, tag, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/npm/-/package/*package_name/dist-tags/${tag}`,
      method: "DELETE",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.6
    *
    * @tags packages_npm
    * @name PostApiV4GroupsIdPackagesNpmNpmV1SecurityAdvisoriesBulk
    * @summary NPM registry bulk advisory endpoint
    * @request POST:/api/v4/groups/{id}/-/packages/npm/-/npm/v1/security/advisories/bulk
    */
    postApiV4GroupsIdPackagesNpmNpmV1SecurityAdvisoriesBulk: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/npm/-/npm/v1/security/advisories/bulk`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.6
    *
    * @tags packages_npm
    * @name PostApiV4GroupsIdPackagesNpmNpmV1SecurityAuditsQuick
    * @summary NPM registry quick audit endpoint
    * @request POST:/api/v4/groups/{id}/-/packages/npm/-/npm/v1/security/audits/quick
    */
    postApiV4GroupsIdPackagesNpmNpmV1SecurityAuditsQuick: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/npm/-/npm/v1/security/audits/quick`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 11.8
    *
    * @tags packages_npm
    * @name GetApiV4GroupsIdPackagesNpmPackageName
    * @summary NPM registry metadata endpoint
    * @request GET:/api/v4/groups/{id}/-/packages/npm/*package_name
    */
    getApiV4GroupsIdPackagesNpmPackageName: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/npm/*package_name`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.6
    *
    * @tags packages_nuget
    * @name GetApiV4GroupsIdPackagesNugetIndex
    * @summary The NuGet V3 Feed Service Index
    * @request GET:/api/v4/groups/{id}/-/packages/nuget/index
    */
    getApiV4GroupsIdPackagesNugetIndex: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/nuget/index`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 16.7
    *
    * @tags packages_nuget
    * @name GetApiV4GroupsIdPackagesNugetSymbolfilesFileNameSignatureSameFileName
    * @summary The NuGet Symbol File Download Endpoint
    * @request GET:/api/v4/groups/{id}/-/packages/nuget/symbolfiles/*file_name/*signature/*same_file_name
    */
    getApiV4GroupsIdPackagesNugetSymbolfilesFileNameSignatureSameFileName: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/nuget/symbolfiles/*file_name/*signature/*same_file_name`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 16.2
    *
    * @tags packages_nuget
    * @name GetApiV4GroupsIdPackagesNugetV2
    * @summary The NuGet V2 Feed Service Index
    * @request GET:/api/v4/groups/{id}/-/packages/nuget/v2
    */
    getApiV4GroupsIdPackagesNugetV2: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/nuget/v2`,
      method: "GET",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 16.3
    *
    * @tags packages_nuget
    * @name GetApiV4GroupsIdPackagesNugetV2Metadata
    * @summary The NuGet V2 Feed Package $metadata endpoint
    * @request GET:/api/v4/groups/{id}/-/packages/nuget/v2/$metadata
    */
    getApiV4GroupsIdPackagesNugetV2Metadata: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/nuget/v2/$metadata`,
      method: "GET",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.8
    *
    * @tags packages_nuget
    * @name GetApiV4GroupsIdPackagesNugetMetadataPackageNameIndex
    * @summary The NuGet Metadata Service - Package name level
    * @request GET:/api/v4/groups/{id}/-/packages/nuget/metadata/*package_name/index
    */
    getApiV4GroupsIdPackagesNugetMetadataPackageNameIndex: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/nuget/metadata/*package_name/index`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.8
    *
    * @tags packages_nuget
    * @name GetApiV4GroupsIdPackagesNugetMetadataPackageNamePackageVersion
    * @summary The NuGet Metadata Service - Package name and version level
    * @request GET:/api/v4/groups/{id}/-/packages/nuget/metadata/*package_name/*package_version
    */
    getApiV4GroupsIdPackagesNugetMetadataPackageNamePackageVersion: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/nuget/metadata/*package_name/*package_version`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.8
    *
    * @tags packages_nuget
    * @name GetApiV4GroupsIdPackagesNugetQuery
    * @summary The NuGet Search Service
    * @request GET:/api/v4/groups/{id}/-/packages/nuget/query
    */
    getApiV4GroupsIdPackagesNugetQuery: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/nuget/query`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.12
    *
    * @tags packages_pypi
    * @name GetApiV4GroupsIdPackagesPypiFilesSha256FileIdentifier
    * @summary Download a package file from a group
    * @request GET:/api/v4/groups/{id}/-/packages/pypi/files/{sha256}/*file_identifier
    */
    getApiV4GroupsIdPackagesPypiFilesSha256FileIdentifier: (id, sha256, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/pypi/files/${sha256}/*file_identifier`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Lists all packages for a specified group in an HTML file.
    *
    * @tags packages_pypi
    * @name GetApiV4GroupsIdPackagesPypiSimple
    * @summary List all packages for a group
    * @request GET:/api/v4/groups/{id}/-/packages/pypi/simple
    */
    getApiV4GroupsIdPackagesPypiSimple: (id, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/pypi/simple`,
      method: "GET",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.10
    *
    * @tags packages_pypi
    * @name GetApiV4GroupsIdPackagesPypiSimplePackageName
    * @summary The PyPi Simple Group Package Endpoint
    * @request GET:/api/v4/groups/{id}/-/packages/pypi/simple/*package_name
    */
    getApiV4GroupsIdPackagesPypiSimplePackageName: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/-/packages/pypi/simple/*package_name`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Lists all releases for projects in a specified group.
    *
    * @tags releases
    * @name GetApiV4GroupsIdReleases
    * @summary List all releases in a group
    * @request GET:/api/v4/groups/{id}/releases
    */
    getApiV4GroupsIdReleases: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/releases`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Rotates a group access token by passing it to the API in a header.
    *
    * @tags access_tokens
    * @name PostApiV4GroupsIdAccessTokensSelfRotate
    * @summary Rotate a group access token
    * @request POST:/api/v4/groups/{id}/access_tokens/self/rotate
    */
    postApiV4GroupsIdAccessTokensSelfRotate: (id, postApiV4GroupsIdAccessTokensSelfRotate, params = {}) => this.request({
      path: `/api/v4/groups/${id}/access_tokens/self/rotate`,
      method: "POST",
      body: postApiV4GroupsIdAccessTokensSelfRotate,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 10.5.
    *
    * @tags search
    * @name GetApiV4GroupsIdSearch
    * @summary Search on GitLab within a group
    * @request GET:/api/v4/groups/{id}/(-/)search
    */
    getApiV4GroupsIdSearch: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/(-/)search`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Lists all wiki pages for a specified group.
    *
    * @tags wikis
    * @name GetApiV4GroupsIdWikis
    * @summary List all wiki pages for a group
    * @request GET:/api/v4/groups/{id}/wikis
    */
    getApiV4GroupsIdWikis: (id, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/wikis`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a wiki page for a specified group. Requests can define the title, slug, and content.
    *
    * @tags wikis
    * @name PostApiV4GroupsIdWikis
    * @summary Create a wiki page for a group
    * @request POST:/api/v4/groups/{id}/wikis
    */
    postApiV4GroupsIdWikis: (id, postApiV4GroupsIdWikis, params = {}) => this.request({
      path: `/api/v4/groups/${id}/wikis`,
      method: "POST",
      body: postApiV4GroupsIdWikis,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified wiki page for a group.
    *
    * @tags wikis
    * @name GetApiV4GroupsIdWikisSlug
    * @summary Retrieve a wiki page for a group
    * @request GET:/api/v4/groups/{id}/wikis/{slug}
    */
    getApiV4GroupsIdWikisSlug: (id, slug, query, params = {}) => this.request({
      path: `/api/v4/groups/${id}/wikis/${slug}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified wiki page for a group.
    *
    * @tags wikis
    * @name PutApiV4GroupsIdWikisSlug
    * @summary Update a wiki page for a group
    * @request PUT:/api/v4/groups/{id}/wikis/{slug}
    */
    putApiV4GroupsIdWikisSlug: (id, slug, putApiV4GroupsIdWikisSlug, params = {}) => this.request({
      path: `/api/v4/groups/${id}/wikis/${slug}`,
      method: "PUT",
      body: putApiV4GroupsIdWikisSlug,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified wiki page from a group.
    *
    * @tags wikis
    * @name DeleteApiV4GroupsIdWikisSlug
    * @summary Delete a wiki page for a group
    * @request DELETE:/api/v4/groups/{id}/wikis/{slug}
    */
    deleteApiV4GroupsIdWikisSlug: (id, slug, params = {}) => this.request({
      path: `/api/v4/groups/${id}/wikis/${slug}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Uploads a file to the `uploads` directory in a specified group wiki.
    *
    * @tags wikis
    * @name PostApiV4GroupsIdWikisAttachments
    * @summary Upload an attachment to a group wiki
    * @request POST:/api/v4/groups/{id}/wikis/attachments
    */
    postApiV4GroupsIdWikisAttachments: (id, postApiV4GroupsIdWikisAttachments, params = {}) => this.request({
      path: `/api/v4/groups/${id}/wikis/attachments`,
      method: "POST",
      body: postApiV4GroupsIdWikisAttachments,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all access requests for a specified project that are viewable by the authenticated user.
    *
    * @tags access_requests
    * @name GetApiV4ProjectsIdAccessRequests
    * @summary List all access requests for a project
    * @request GET:/api/v4/projects/{id}/access_requests
    */
    getApiV4ProjectsIdAccessRequests: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/access_requests`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Requests access to a specified project for the authenticated user.
    *
    * @tags access_requests
    * @name PostApiV4ProjectsIdAccessRequests
    * @summary Request access to a project
    * @request POST:/api/v4/projects/{id}/access_requests
    */
    postApiV4ProjectsIdAccessRequests: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/access_requests`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Approves an access request for a specified user in a project.
    *
    * @tags access_requests
    * @name PutApiV4ProjectsIdAccessRequestsUserIdApprove
    * @summary Approve an access request
    * @request PUT:/api/v4/projects/{id}/access_requests/{user_id}/approve
    */
    putApiV4ProjectsIdAccessRequestsUserIdApprove: (id, userId, putApiV4ProjectsIdAccessRequestsUserIdApprove, params = {}) => this.request({
      path: `/api/v4/projects/${id}/access_requests/${userId}/approve`,
      method: "PUT",
      body: putApiV4ProjectsIdAccessRequestsUserIdApprove,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Denies an access request for a specified user in a project.
    *
    * @tags access_requests
    * @name DeleteApiV4ProjectsIdAccessRequestsUserId
    * @summary Deny an access request
    * @request DELETE:/api/v4/projects/{id}/access_requests/{user_id}
    */
    deleteApiV4ProjectsIdAccessRequestsUserId: (id, userId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/access_requests/${userId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Workhorse authorize metric image file upload
    *
    * @tags alert_management
    * @name PostApiV4ProjectsIdAlertManagementAlertsAlertIidMetricImagesAuthorize
    * @request POST:/api/v4/projects/{id}/alert_management_alerts/{alert_iid}/metric_images/authorize
    */
    postApiV4ProjectsIdAlertManagementAlertsAlertIidMetricImagesAuthorize: (id, alertIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/alert_management_alerts/${alertIid}/metric_images/authorize`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Uploads a metric image for a specified alert.
    *
    * @tags alert_management
    * @name PostApiV4ProjectsIdAlertManagementAlertsAlertIidMetricImages
    * @summary Upload a metric image
    * @request POST:/api/v4/projects/{id}/alert_management_alerts/{alert_iid}/metric_images
    */
    postApiV4ProjectsIdAlertManagementAlertsAlertIidMetricImages: (id, alertIid, data, params = {}) => this.request({
      path: `/api/v4/projects/${id}/alert_management_alerts/${alertIid}/metric_images`,
      method: "POST",
      body: data,
      type: "multipart/form-data" /* FormData */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all metric images for a specified alert.
    *
    * @tags alert_management
    * @name GetApiV4ProjectsIdAlertManagementAlertsAlertIidMetricImages
    * @summary List all metric images
    * @request GET:/api/v4/projects/{id}/alert_management_alerts/{alert_iid}/metric_images
    */
    getApiV4ProjectsIdAlertManagementAlertsAlertIidMetricImages: (id, alertIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/alert_management_alerts/${alertIid}/metric_images`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified metric image for an alert.
    *
    * @tags alert_management
    * @name PutApiV4ProjectsIdAlertManagementAlertsAlertIidMetricImagesMetricImageId
    * @summary Update a metric image
    * @request PUT:/api/v4/projects/{id}/alert_management_alerts/{alert_iid}/metric_images/{metric_image_id}
    */
    putApiV4ProjectsIdAlertManagementAlertsAlertIidMetricImagesMetricImageId: (id, alertIid, metricImageId, data, params = {}) => this.request({
      path: `/api/v4/projects/${id}/alert_management_alerts/${alertIid}/metric_images/${metricImageId}`,
      method: "PUT",
      body: data,
      type: "multipart/form-data" /* FormData */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified metric image for an alert.
    *
    * @tags alert_management
    * @name DeleteApiV4ProjectsIdAlertManagementAlertsAlertIidMetricImagesMetricImageId
    * @summary Delete a metric image
    * @request DELETE:/api/v4/projects/{id}/alert_management_alerts/{alert_iid}/metric_images/{metric_image_id}
    */
    deleteApiV4ProjectsIdAlertManagementAlertsAlertIidMetricImagesMetricImageId: (id, alertIid, metricImageId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/alert_management_alerts/${alertIid}/metric_images/${metricImageId}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all emoji reactions for a specified issue. This endpoint can be accessed without authentication if the issue is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4ProjectsIdIssuesIssueIidAwardEmoji
    * @summary List all emoji reactions for an issue
    * @request GET:/api/v4/projects/{id}/issues/{issue_iid}/award_emoji
    */
    getApiV4ProjectsIdIssuesIssueIidAwardEmoji: (id, issueIid, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/award_emoji`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds an emoji reaction to an issue.
    *
    * @tags award_emoji
    * @name PostApiV4ProjectsIdIssuesIssueIidAwardEmoji
    * @summary Add an emoji reaction to an issue
    * @request POST:/api/v4/projects/{id}/issues/{issue_iid}/award_emoji
    */
    postApiV4ProjectsIdIssuesIssueIidAwardEmoji: (id, issueIid, postApiV4ProjectsIdIssuesIssueIidAwardEmoji, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/award_emoji`,
      method: "POST",
      body: postApiV4ProjectsIdIssuesIssueIidAwardEmoji,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified emoji reaction from an issue. This endpoint can be accessed without authentication if the issue is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4ProjectsIdIssuesIssueIidAwardEmojiAwardId
    * @summary Retrieve an emoji reaction from an issue
    * @request GET:/api/v4/projects/{id}/issues/{issue_iid}/award_emoji/{award_id}
    */
    getApiV4ProjectsIdIssuesIssueIidAwardEmojiAwardId: (awardId, id, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/award_emoji/${awardId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified emoji reaction from an issue. Only an administrator or the user who added the reaction can delete it.
    *
    * @tags award_emoji
    * @name DeleteApiV4ProjectsIdIssuesIssueIidAwardEmojiAwardId
    * @summary Delete an emoji reaction from an issue
    * @request DELETE:/api/v4/projects/{id}/issues/{issue_iid}/award_emoji/{award_id}
    */
    deleteApiV4ProjectsIdIssuesIssueIidAwardEmojiAwardId: (awardId, id, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/award_emoji/${awardId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all emoji reactions for a specified comment on an issue. This endpoint can be accessed without authentication if the comment is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4ProjectsIdIssuesIssueIidNotesNoteIdAwardEmoji
    * @summary List all emoji reactions for an issue comment
    * @request GET:/api/v4/projects/{id}/issues/{issue_iid}/notes/{note_id}/award_emoji
    */
    getApiV4ProjectsIdIssuesIssueIidNotesNoteIdAwardEmoji: (id, issueIid, noteId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/notes/${noteId}/award_emoji`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds an emoji reaction to a comment on an issue.
    *
    * @tags award_emoji
    * @name PostApiV4ProjectsIdIssuesIssueIidNotesNoteIdAwardEmoji
    * @summary Add an emoji reaction to an issue comment
    * @request POST:/api/v4/projects/{id}/issues/{issue_iid}/notes/{note_id}/award_emoji
    */
    postApiV4ProjectsIdIssuesIssueIidNotesNoteIdAwardEmoji: (id, issueIid, noteId, postApiV4ProjectsIdIssuesIssueIidNotesNoteIdAwardEmoji, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/notes/${noteId}/award_emoji`,
      method: "POST",
      body: postApiV4ProjectsIdIssuesIssueIidNotesNoteIdAwardEmoji,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified emoji reaction from a comment on an issue. This endpoint can be accessed without authentication if the comment is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4ProjectsIdIssuesIssueIidNotesNoteIdAwardEmojiAwardId
    * @summary Retrieve an emoji reaction from an issue comment
    * @request GET:/api/v4/projects/{id}/issues/{issue_iid}/notes/{note_id}/award_emoji/{award_id}
    */
    getApiV4ProjectsIdIssuesIssueIidNotesNoteIdAwardEmojiAwardId: (awardId, id, issueIid, noteId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/notes/${noteId}/award_emoji/${awardId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified emoji reaction from a comment on an issue. Only an administrator or the user who added the reaction can delete it.
    *
    * @tags award_emoji
    * @name DeleteApiV4ProjectsIdIssuesIssueIidNotesNoteIdAwardEmojiAwardId
    * @summary Delete an emoji reaction from an issue comment
    * @request DELETE:/api/v4/projects/{id}/issues/{issue_iid}/notes/{note_id}/award_emoji/{award_id}
    */
    deleteApiV4ProjectsIdIssuesIssueIidNotesNoteIdAwardEmojiAwardId: (awardId, id, issueIid, noteId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/notes/${noteId}/award_emoji/${awardId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all emoji reactions for a specified merge request. This endpoint can be accessed without authentication if the merge request is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidAwardEmoji
    * @summary List all emoji reactions for a merge request
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/award_emoji
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidAwardEmoji: (id, mergeRequestIid, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/award_emoji`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds an emoji reaction to a merge request.
    *
    * @tags award_emoji
    * @name PostApiV4ProjectsIdMergeRequestsMergeRequestIidAwardEmoji
    * @summary Add an emoji reaction to a merge request
    * @request POST:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/award_emoji
    */
    postApiV4ProjectsIdMergeRequestsMergeRequestIidAwardEmoji: (id, mergeRequestIid, postApiV4ProjectsIdMergeRequestsMergeRequestIidAwardEmoji, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/award_emoji`,
      method: "POST",
      body: postApiV4ProjectsIdMergeRequestsMergeRequestIidAwardEmoji,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified emoji reaction from a merge request. This endpoint can be accessed without authentication if the merge request is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidAwardEmojiAwardId
    * @summary Retrieve an emoji reaction from a merge request
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/award_emoji/{award_id}
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidAwardEmojiAwardId: (awardId, id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/award_emoji/${awardId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified emoji reaction from a merge request. Only an administrator or the user who added the reaction can delete it.
    *
    * @tags award_emoji
    * @name DeleteApiV4ProjectsIdMergeRequestsMergeRequestIidAwardEmojiAwardId
    * @summary Delete an emoji reaction from a merge request
    * @request DELETE:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/award_emoji/{award_id}
    */
    deleteApiV4ProjectsIdMergeRequestsMergeRequestIidAwardEmojiAwardId: (awardId, id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/award_emoji/${awardId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all emoji reactions for a specified comment on a merge request. This endpoint can be accessed without authentication if the comment is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidNotesNoteIdAwardEmoji
    * @summary List all emoji reactions for a merge request comment
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/notes/{note_id}/award_emoji
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidNotesNoteIdAwardEmoji: (id, mergeRequestIid, noteId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/notes/${noteId}/award_emoji`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds an emoji reaction to a comment on a merge request.
    *
    * @tags award_emoji
    * @name PostApiV4ProjectsIdMergeRequestsMergeRequestIidNotesNoteIdAwardEmoji
    * @summary Add an emoji reaction to a merge request comment
    * @request POST:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/notes/{note_id}/award_emoji
    */
    postApiV4ProjectsIdMergeRequestsMergeRequestIidNotesNoteIdAwardEmoji: (id, mergeRequestIid, noteId, postApiV4ProjectsIdMergeRequestsMergeRequestIidNotesNoteIdAwardEmoji, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/notes/${noteId}/award_emoji`,
      method: "POST",
      body: postApiV4ProjectsIdMergeRequestsMergeRequestIidNotesNoteIdAwardEmoji,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified emoji reaction from a comment on a merge request. This endpoint can be accessed without authentication if the comment is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidNotesNoteIdAwardEmojiAwardId
    * @summary Retrieve an emoji reaction from a merge request comment
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/notes/{note_id}/award_emoji/{award_id}
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidNotesNoteIdAwardEmojiAwardId: (awardId, id, mergeRequestIid, noteId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/notes/${noteId}/award_emoji/${awardId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified emoji reaction from a comment on a merge request. Only an administrator or the user who added the reaction can delete it.
    *
    * @tags award_emoji
    * @name DeleteApiV4ProjectsIdMergeRequestsMergeRequestIidNotesNoteIdAwardEmojiAwardId
    * @summary Delete an emoji reaction from a merge request comment
    * @request DELETE:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/notes/{note_id}/award_emoji/{award_id}
    */
    deleteApiV4ProjectsIdMergeRequestsMergeRequestIidNotesNoteIdAwardEmojiAwardId: (awardId, id, mergeRequestIid, noteId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/notes/${noteId}/award_emoji/${awardId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all emoji reactions for a specified snippet. This endpoint can be accessed without authentication if the snippet is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4ProjectsIdSnippetsSnippetIdAwardEmoji
    * @summary List all emoji reactions for a snippet
    * @request GET:/api/v4/projects/{id}/snippets/{snippet_id}/award_emoji
    */
    getApiV4ProjectsIdSnippetsSnippetIdAwardEmoji: (id, snippetId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets/${snippetId}/award_emoji`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds an emoji reaction to a snippet.
    *
    * @tags award_emoji
    * @name PostApiV4ProjectsIdSnippetsSnippetIdAwardEmoji
    * @summary Add an emoji reaction to a snippet
    * @request POST:/api/v4/projects/{id}/snippets/{snippet_id}/award_emoji
    */
    postApiV4ProjectsIdSnippetsSnippetIdAwardEmoji: (id, snippetId, postApiV4ProjectsIdSnippetsSnippetIdAwardEmoji, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets/${snippetId}/award_emoji`,
      method: "POST",
      body: postApiV4ProjectsIdSnippetsSnippetIdAwardEmoji,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified emoji reaction from a snippet. This endpoint can be accessed without authentication if the snippet is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4ProjectsIdSnippetsSnippetIdAwardEmojiAwardId
    * @summary Retrieve an emoji reaction from a snippet
    * @request GET:/api/v4/projects/{id}/snippets/{snippet_id}/award_emoji/{award_id}
    */
    getApiV4ProjectsIdSnippetsSnippetIdAwardEmojiAwardId: (awardId, id, snippetId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets/${snippetId}/award_emoji/${awardId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified emoji reaction from a snippet. Only an administrator or the user who added the reaction can delete it.
    *
    * @tags award_emoji
    * @name DeleteApiV4ProjectsIdSnippetsSnippetIdAwardEmojiAwardId
    * @summary Delete an emoji reaction from a snippet
    * @request DELETE:/api/v4/projects/{id}/snippets/{snippet_id}/award_emoji/{award_id}
    */
    deleteApiV4ProjectsIdSnippetsSnippetIdAwardEmojiAwardId: (awardId, id, snippetId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets/${snippetId}/award_emoji/${awardId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all emoji reactions for a specified comment on a snippet. This endpoint can be accessed without authentication if the comment is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4ProjectsIdSnippetsSnippetIdNotesNoteIdAwardEmoji
    * @summary List all emoji reactions for a snippet comment
    * @request GET:/api/v4/projects/{id}/snippets/{snippet_id}/notes/{note_id}/award_emoji
    */
    getApiV4ProjectsIdSnippetsSnippetIdNotesNoteIdAwardEmoji: (id, snippetId, noteId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets/${snippetId}/notes/${noteId}/award_emoji`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds an emoji reaction to a comment on a snippet.
    *
    * @tags award_emoji
    * @name PostApiV4ProjectsIdSnippetsSnippetIdNotesNoteIdAwardEmoji
    * @summary Add an emoji reaction to a snippet comment
    * @request POST:/api/v4/projects/{id}/snippets/{snippet_id}/notes/{note_id}/award_emoji
    */
    postApiV4ProjectsIdSnippetsSnippetIdNotesNoteIdAwardEmoji: (id, snippetId, noteId, postApiV4ProjectsIdSnippetsSnippetIdNotesNoteIdAwardEmoji, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets/${snippetId}/notes/${noteId}/award_emoji`,
      method: "POST",
      body: postApiV4ProjectsIdSnippetsSnippetIdNotesNoteIdAwardEmoji,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified emoji reaction from a comment on a snippet. This endpoint can be accessed without authentication if the comment is publicly accessible.
    *
    * @tags award_emoji
    * @name GetApiV4ProjectsIdSnippetsSnippetIdNotesNoteIdAwardEmojiAwardId
    * @summary Retrieve an emoji reaction from a snippet comment
    * @request GET:/api/v4/projects/{id}/snippets/{snippet_id}/notes/{note_id}/award_emoji/{award_id}
    */
    getApiV4ProjectsIdSnippetsSnippetIdNotesNoteIdAwardEmojiAwardId: (awardId, id, snippetId, noteId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets/${snippetId}/notes/${noteId}/award_emoji/${awardId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified emoji reaction from a comment on a snippet. Only an administrator or the user who added the reaction can delete it.
    *
    * @tags award_emoji
    * @name DeleteApiV4ProjectsIdSnippetsSnippetIdNotesNoteIdAwardEmojiAwardId
    * @summary Delete an emoji reaction from a snippet comment
    * @request DELETE:/api/v4/projects/{id}/snippets/{snippet_id}/notes/{note_id}/award_emoji/{award_id}
    */
    deleteApiV4ProjectsIdSnippetsSnippetIdNotesNoteIdAwardEmojiAwardId: (awardId, id, snippetId, noteId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets/${snippetId}/notes/${noteId}/award_emoji/${awardId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all badges for a specified project, including group badges.
    *
    * @tags badges
    * @name GetApiV4ProjectsIdBadges
    * @summary List all badges for a project
    * @request GET:/api/v4/projects/{id}/badges
    */
    getApiV4ProjectsIdBadges: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/badges`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a badge for a specified project.
    *
    * @tags badges
    * @name PostApiV4ProjectsIdBadges
    * @summary Create a badge for a project
    * @request POST:/api/v4/projects/{id}/badges
    */
    postApiV4ProjectsIdBadges: (id, postApiV4ProjectsIdBadges, params = {}) => this.request({
      path: `/api/v4/projects/${id}/badges`,
      method: "POST",
      body: postApiV4ProjectsIdBadges,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Previews the final `link_url` and `image_url` for a specified project after resolving the placeholder interpolation.
    *
    * @tags badges
    * @name GetApiV4ProjectsIdBadgesRender
    * @summary Retrieve a badge preview for a project
    * @request GET:/api/v4/projects/{id}/badges/render
    */
    getApiV4ProjectsIdBadgesRender: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/badges/render`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified badge for a project.
    *
    * @tags badges
    * @name GetApiV4ProjectsIdBadgesBadgeId
    * @summary Retrieve a badge for a project
    * @request GET:/api/v4/projects/{id}/badges/{badge_id}
    */
    getApiV4ProjectsIdBadgesBadgeId: (id, badgeId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/badges/${badgeId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified badge for a project.
    *
    * @tags badges
    * @name PutApiV4ProjectsIdBadgesBadgeId
    * @summary Update a badge for a project
    * @request PUT:/api/v4/projects/{id}/badges/{badge_id}
    */
    putApiV4ProjectsIdBadgesBadgeId: (id, badgeId, putApiV4ProjectsIdBadgesBadgeId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/badges/${badgeId}`,
      method: "PUT",
      body: putApiV4ProjectsIdBadgesBadgeId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified badge from a project.
    *
    * @tags badges
    * @name DeleteApiV4ProjectsIdBadgesBadgeId
    * @summary Delete a badge from a project
    * @request DELETE:/api/v4/projects/{id}/badges/{badge_id}
    */
    deleteApiV4ProjectsIdBadgesBadgeId: (id, badgeId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/badges/${badgeId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all repository branches from a specified project, sorted alphabetically by name. Search by name, or use regular expressions to find specific branch patterns. Returns detailed information about the branch, including its protection status, merge status, and commit details.
    *
    * @tags branches
    * @name GetApiV4ProjectsIdRepositoryBranches
    * @summary List all repository branches
    * @request GET:/api/v4/projects/{id}/repository/branches
    */
    getApiV4ProjectsIdRepositoryBranches: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/branches`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a branch in the repository.
    *
    * @tags branches
    * @name PostApiV4ProjectsIdRepositoryBranches
    * @summary Create a repository branch
    * @request POST:/api/v4/projects/{id}/repository/branches
    */
    postApiV4ProjectsIdRepositoryBranches: (id, postApiV4ProjectsIdRepositoryBranches, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/branches`,
      method: "POST",
      body: postApiV4ProjectsIdRepositoryBranches,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Check if a branch exists
    *
    * @tags branches
    * @name HeadApiV4ProjectsIdRepositoryBranchesBranch
    * @request HEAD:/api/v4/projects/{id}/repository/branches/{branch}
    */
    headApiV4ProjectsIdRepositoryBranchesBranch: (id, branch, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/branches/${branch}`,
      method: "HEAD",
      ...params
    }),
    /**
    * @description Retrieves a specified project repository branch.
    *
    * @tags branches
    * @name GetApiV4ProjectsIdRepositoryBranchesBranch
    * @summary Retrieve a repository branch
    * @request GET:/api/v4/projects/{id}/repository/branches/{branch}
    */
    getApiV4ProjectsIdRepositoryBranchesBranch: (id, branch, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/branches/${branch}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified branch from the repository.
    *
    * @tags branches
    * @name DeleteApiV4ProjectsIdRepositoryBranchesBranch
    * @summary Delete a repository branch
    * @request DELETE:/api/v4/projects/{id}/repository/branches/{branch}
    */
    deleteApiV4ProjectsIdRepositoryBranchesBranch: (id, branch, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/branches/${branch}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Protect a single branch
    *
    * @tags branches
    * @name PutApiV4ProjectsIdRepositoryBranchesBranchProtect
    * @request PUT:/api/v4/projects/{id}/repository/branches/{branch}/protect
    */
    putApiV4ProjectsIdRepositoryBranchesBranchProtect: (id, branch, putApiV4ProjectsIdRepositoryBranchesBranchProtect, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/branches/${branch}/protect`,
      method: "PUT",
      body: putApiV4ProjectsIdRepositoryBranchesBranchProtect,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Unprotect a single branch
    *
    * @tags branches
    * @name PutApiV4ProjectsIdRepositoryBranchesBranchUnprotect
    * @request PUT:/api/v4/projects/{id}/repository/branches/{branch}/unprotect
    */
    putApiV4ProjectsIdRepositoryBranchesBranchUnprotect: (id, branch, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/branches/${branch}/unprotect`,
      method: "PUT",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes all branches that are merged into the default branch for a project.
    *
    * @tags branches
    * @name DeleteApiV4ProjectsIdRepositoryMergedBranches
    * @summary Delete all merged branches
    * @request DELETE:/api/v4/projects/{id}/repository/merged_branches
    */
    deleteApiV4ProjectsIdRepositoryMergedBranches: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/merged_branches`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Publishes a release of a catalog resource as version to the CI/CD catalog.
    *
    * @tags ci_catalog
    * @name PostApiV4ProjectsIdCatalogPublish
    * @summary Publish a new component project release as version to the CI/CD catalog
    * @request POST:/api/v4/projects/{id}/catalog/publish
    */
    postApiV4ProjectsIdCatalogPublish: (id, postApiV4ProjectsIdCatalogPublish, params = {}) => this.request({
      path: `/api/v4/projects/${id}/catalog/publish`,
      method: "POST",
      body: postApiV4ProjectsIdCatalogPublish,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the artifacts archive for the latest successful job on a specified branch or tag.
    *
    * @tags job_artifacts
    * @name GetApiV4ProjectsIdJobsArtifactsRefNameDownload
    * @summary Retrieve job artifacts
    * @request GET:/api/v4/projects/{id}/jobs/artifacts/{ref_name}/download
    */
    getApiV4ProjectsIdJobsArtifactsRefNameDownload: (id, refName, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/jobs/artifacts/${refName}/download`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 11.5
    *
    * @tags job_artifacts
    * @name GetApiV4ProjectsIdJobsArtifactsRefNameRawArtifactPath
    * @summary Download a specific file from artifacts archive from a ref
    * @request GET:/api/v4/projects/{id}/jobs/artifacts/{ref_name}/raw/*artifact_path
    */
    getApiV4ProjectsIdJobsArtifactsRefNameRawArtifactPath: (id, refName, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/jobs/artifacts/${refName}/raw/*artifact_path`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 8.5
    *
    * @tags job_artifacts
    * @name GetApiV4ProjectsIdJobsJobIdArtifacts
    * @summary Download the artifacts archive from a job
    * @request GET:/api/v4/projects/{id}/jobs/{job_id}/artifacts
    */
    getApiV4ProjectsIdJobsJobIdArtifacts: (id, jobId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/jobs/${jobId}/artifacts`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Deletes job artifacts from a specified job in a project.
    *
    * @tags job_artifacts
    * @name DeleteApiV4ProjectsIdJobsJobIdArtifacts
    * @summary Delete job artifacts
    * @request DELETE:/api/v4/projects/{id}/jobs/{job_id}/artifacts
    */
    deleteApiV4ProjectsIdJobsJobIdArtifacts: (id, jobId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/jobs/${jobId}/artifacts`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all files in a specified artifacts archive without extracting them.
    *
    * @tags job_artifacts
    * @name GetApiV4ProjectsIdJobsJobIdArtifactsTree
    * @summary List all files in an artifacts archive
    * @request GET:/api/v4/projects/{id}/jobs/{job_id}/artifacts/tree
    */
    getApiV4ProjectsIdJobsJobIdArtifactsTree: (id, jobId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/jobs/${jobId}/artifacts/tree`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 10.0
    *
    * @tags job_artifacts
    * @name GetApiV4ProjectsIdJobsJobIdArtifactsArtifactPath
    * @summary Download a specific file from artifacts archive
    * @request GET:/api/v4/projects/{id}/jobs/{job_id}/artifacts/*artifact_path
    */
    getApiV4ProjectsIdJobsJobIdArtifactsArtifactPath: (id, jobId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/jobs/${jobId}/artifacts/*artifact_path`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Retains job artifacts. Prevents artifacts for a job from being automatically deleted when they reach their expiration date.
    *
    * @tags job_artifacts
    * @name PostApiV4ProjectsIdJobsJobIdArtifactsKeep
    * @summary Retain job artifacts
    * @request POST:/api/v4/projects/{id}/jobs/{job_id}/artifacts/keep
    */
    postApiV4ProjectsIdJobsJobIdArtifactsKeep: (id, jobId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/jobs/${jobId}/artifacts/keep`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes job artifacts from all jobs in a specified project.
    *
    * @tags job_artifacts
    * @name DeleteApiV4ProjectsIdArtifacts
    * @summary Delete all job artifacts in a project
    * @request DELETE:/api/v4/projects/{id}/artifacts
    */
    deleteApiV4ProjectsIdArtifacts: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/artifacts`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all jobs for a specified project. By default, this request returns 20 results at a time because the API results are paginated.
    *
    * @tags ci_jobs
    * @name GetApiV4ProjectsIdJobs
    * @summary List all jobs for a project
    * @request GET:/api/v4/projects/{id}/jobs
    */
    getApiV4ProjectsIdJobs: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/jobs`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a job with the specified job ID.
    *
    * @tags ci_jobs
    * @name GetApiV4ProjectsIdJobsJobId
    * @summary Retrieve a job
    * @request GET:/api/v4/projects/{id}/jobs/{job_id}
    */
    getApiV4ProjectsIdJobsJobId: (jobId, id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/jobs/${jobId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a log file for a job.
    *
    * @tags ci_jobs
    * @name GetApiV4ProjectsIdJobsJobIdTrace
    * @summary Get a trace of a specific job of a project
    * @request GET:/api/v4/projects/{id}/jobs/{job_id}/trace
    */
    getApiV4ProjectsIdJobsJobIdTrace: (id, jobId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/jobs/${jobId}/trace`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Cancels a specified job in a project.
    *
    * @tags ci_jobs
    * @name PostApiV4ProjectsIdJobsJobIdCancel
    * @summary Cancel a job
    * @request POST:/api/v4/projects/{id}/jobs/{job_id}/cancel
    */
    postApiV4ProjectsIdJobsJobIdCancel: (jobId, id, postApiV4ProjectsIdJobsJobIdCancel, params = {}) => this.request({
      path: `/api/v4/projects/${id}/jobs/${jobId}/cancel`,
      method: "POST",
      body: postApiV4ProjectsIdJobsJobIdCancel,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retries a specified job in a project.
    *
    * @tags ci_jobs
    * @name PostApiV4ProjectsIdJobsJobIdRetry
    * @summary Retry a job
    * @request POST:/api/v4/projects/{id}/jobs/{job_id}/retry
    */
    postApiV4ProjectsIdJobsJobIdRetry: (jobId, id, postApiV4ProjectsIdJobsJobIdRetry, params = {}) => this.request({
      path: `/api/v4/projects/${id}/jobs/${jobId}/retry`,
      method: "POST",
      body: postApiV4ProjectsIdJobsJobIdRetry,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Erases a specified job in a project. This removes job artifacts and the job log.
    *
    * @tags ci_jobs
    * @name PostApiV4ProjectsIdJobsJobIdErase
    * @summary Erase a job
    * @request POST:/api/v4/projects/{id}/jobs/{job_id}/erase
    */
    postApiV4ProjectsIdJobsJobIdErase: (jobId, id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/jobs/${jobId}/erase`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Runs a specified job. For a job in manual status, triggers an action to start the job.
    *
    * @tags ci_jobs
    * @name PostApiV4ProjectsIdJobsJobIdPlay
    * @summary Run a job
    * @request POST:/api/v4/projects/{id}/jobs/{job_id}/play
    */
    postApiV4ProjectsIdJobsJobIdPlay: (jobId, id, postApiV4ProjectsIdJobsJobIdPlay, params = {}) => this.request({
      path: `/api/v4/projects/${id}/jobs/${jobId}/play`,
      method: "POST",
      body: postApiV4ProjectsIdJobsJobIdPlay,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all resource groups for a specified project.
    *
    * @tags ci_resource_groups
    * @name GetApiV4ProjectsIdResourceGroups
    * @summary List all resource groups
    * @request GET:/api/v4/projects/{id}/resource_groups
    */
    getApiV4ProjectsIdResourceGroups: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/resource_groups`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified resource group for a project.
    *
    * @tags ci_resource_groups
    * @name GetApiV4ProjectsIdResourceGroupsKey
    * @summary Retrieve a resource group
    * @request GET:/api/v4/projects/{id}/resource_groups/{key}
    */
    getApiV4ProjectsIdResourceGroupsKey: (id, key, params = {}) => this.request({
      path: `/api/v4/projects/${id}/resource_groups/${key}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates the properties for a specified resource group. It returns `200` if the resource group was successfully updated. In case of an error, a status code `400` is returned.
    *
    * @tags ci_resource_groups
    * @name PutApiV4ProjectsIdResourceGroupsKey
    * @summary Update a resource group
    * @request PUT:/api/v4/projects/{id}/resource_groups/{key}
    */
    putApiV4ProjectsIdResourceGroupsKey: (id, key, putApiV4ProjectsIdResourceGroupsKey, params = {}) => this.request({
      path: `/api/v4/projects/${id}/resource_groups/${key}`,
      method: "PUT",
      body: putApiV4ProjectsIdResourceGroupsKey,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the current job for a specified resource group in a project.
    *
    * @tags ci_resource_groups
    * @name GetApiV4ProjectsIdResourceGroupsKeyCurrentJob
    * @summary Retrieve current job for a resource group
    * @request GET:/api/v4/projects/{id}/resource_groups/{key}/current_job
    */
    getApiV4ProjectsIdResourceGroupsKeyCurrentJob: (id, key, params = {}) => this.request({
      path: `/api/v4/projects/${id}/resource_groups/${key}/current_job`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all upcoming jobs for a specified resource group.
    *
    * @tags ci_resource_groups
    * @name GetApiV4ProjectsIdResourceGroupsKeyUpcomingJobs
    * @summary List all upcoming jobs for a resource group
    * @request GET:/api/v4/projects/{id}/resource_groups/{key}/upcoming_jobs
    */
    getApiV4ProjectsIdResourceGroupsKeyUpcomingJobs: (id, key, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/resource_groups/${key}/upcoming_jobs`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description List all runners available in the project, including from ancestor groups and any allowed shared runners.
    *
    * @tags runners, projects
    * @name GetApiV4ProjectsIdRunners
    * @summary List project's runners
    * @request GET:/api/v4/projects/{id}/runners
    */
    getApiV4ProjectsIdRunners: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/runners`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Assigns an available project runner to a project.
    *
    * @tags runners, projects
    * @name PostApiV4ProjectsIdRunners
    * @summary Assign a runner to a project
    * @request POST:/api/v4/projects/{id}/runners
    */
    postApiV4ProjectsIdRunners: (id, postApiV4ProjectsIdRunners, params = {}) => this.request({
      path: `/api/v4/projects/${id}/runners`,
      method: "POST",
      body: postApiV4ProjectsIdRunners,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Unassigns a specified project runner from a project. You cannot unassign a runner from the owner project. Use the delete a runner operation instead.
    *
    * @tags runners, projects
    * @name DeleteApiV4ProjectsIdRunnersRunnerId
    * @summary Unassign a runner from a project
    * @request DELETE:/api/v4/projects/{id}/runners/{runner_id}
    */
    deleteApiV4ProjectsIdRunnersRunnerId: (id, runnerId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/runners/${runnerId}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description Resets the runner registration token for a specified project.
    *
    * @tags runners, projects
    * @name PostApiV4ProjectsIdRunnersResetRegistrationToken
    * @summary Reset the runner registration token for a project
    * @request POST:/api/v4/projects/{id}/runners/reset_registration_token
    */
    postApiV4ProjectsIdRunnersResetRegistrationToken: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/runners/reset_registration_token`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all secure files for a specified project.
    *
    * @tags secure_files
    * @name GetApiV4ProjectsIdSecureFiles
    * @summary List all secure files for a project
    * @request GET:/api/v4/projects/{id}/secure_files
    */
    getApiV4ProjectsIdSecureFiles: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/secure_files`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a secure file in a specified project.
    *
    * @tags secure_files
    * @name PostApiV4ProjectsIdSecureFiles
    * @summary Create a secure file
    * @request POST:/api/v4/projects/{id}/secure_files
    */
    postApiV4ProjectsIdSecureFiles: (id, postApiV4ProjectsIdSecureFiles, params = {}) => this.request({
      path: `/api/v4/projects/${id}/secure_files`,
      method: "POST",
      body: postApiV4ProjectsIdSecureFiles,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves details of a specified secure file in a project.
    *
    * @tags secure_files
    * @name GetApiV4ProjectsIdSecureFilesSecureFileId
    * @summary Retrieve details of a secure file
    * @request GET:/api/v4/projects/{id}/secure_files/{secure_file_id}
    */
    getApiV4ProjectsIdSecureFilesSecureFileId: (id, secureFileId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/secure_files/${secureFileId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified secure file from a project.
    *
    * @tags secure_files
    * @name DeleteApiV4ProjectsIdSecureFilesSecureFileId
    * @summary Delete a secure file
    * @request DELETE:/api/v4/projects/{id}/secure_files/{secure_file_id}
    */
    deleteApiV4ProjectsIdSecureFilesSecureFileId: (id, secureFileId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/secure_files/${secureFileId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Downloads the contents of a specified secure file in a project.
    *
    * @tags secure_files
    * @name GetApiV4ProjectsIdSecureFilesSecureFileIdDownload
    * @summary Download a secure file
    * @request GET:/api/v4/projects/{id}/secure_files/{secure_file_id}/download
    */
    getApiV4ProjectsIdSecureFilesSecureFileIdDownload: (id, secureFileId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/secure_files/${secureFileId}/download`,
      method: "GET",
      ...params
    }),
    /**
    * @description Lists all pipelines in a project. By default, child pipelines are not included in the results. To return child pipelines, set `source` to `parent_pipeline`.
    *
    * @tags pipelines
    * @name GetApiV4ProjectsIdPipelines
    * @summary List all project pipelines
    * @request GET:/api/v4/projects/{id}/pipelines
    */
    getApiV4ProjectsIdPipelines: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipelines`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a pipeline in the specified project.
    *
    * @tags pipelines
    * @name PostApiV4ProjectsIdPipeline
    * @summary Create a pipeline
    * @request POST:/api/v4/projects/{id}/pipeline
    */
    postApiV4ProjectsIdPipeline: (id, postApiV4ProjectsIdPipeline, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipeline`,
      method: "POST",
      body: postApiV4ProjectsIdPipeline,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the latest pipeline for the most recent commit on a specified ref in a project. If no pipeline exists for the commit, a `403` status code is returned. Use the `page` and `per_page` pagination parameters to control the pagination of results.
    *
    * @tags pipelines
    * @name GetApiV4ProjectsIdPipelinesLatest
    * @summary Retrieve the latest pipeline
    * @request GET:/api/v4/projects/{id}/pipelines/latest
    */
    getApiV4ProjectsIdPipelinesLatest: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipelines/latest`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified pipeline from a project. You can also get a child pipeline.
    *
    * @tags pipelines
    * @name GetApiV4ProjectsIdPipelinesPipelineId
    * @summary Retrieve a pipeline
    * @request GET:/api/v4/projects/{id}/pipelines/{pipeline_id}
    */
    getApiV4ProjectsIdPipelinesPipelineId: (id, pipelineId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipelines/${pipelineId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified pipeline for a project.
    *
    * @tags pipelines
    * @name DeleteApiV4ProjectsIdPipelinesPipelineId
    * @summary Delete a pipeline
    * @request DELETE:/api/v4/projects/{id}/pipelines/{pipeline_id}
    */
    deleteApiV4ProjectsIdPipelinesPipelineId: (id, pipelineId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipelines/${pipelineId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all jobs for a specified pipeline.
    *
    * @tags pipelines
    * @name GetApiV4ProjectsIdPipelinesPipelineIdJobs
    * @summary List all jobs by pipeline
    * @request GET:/api/v4/projects/{id}/pipelines/{pipeline_id}/jobs
    */
    getApiV4ProjectsIdPipelinesPipelineIdJobs: (id, pipelineId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipelines/${pipelineId}/jobs`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Deprecated in GitLab 19.2. Use trigger_jobs endpoint instead.
    *
    * @tags pipelines
    * @name GetApiV4ProjectsIdPipelinesPipelineIdBridges
    * @summary List all bridge jobs by pipeline
    * @request GET:/api/v4/projects/{id}/pipelines/{pipeline_id}/bridges
    * @deprecated
    */
    getApiV4ProjectsIdPipelinesPipelineIdBridges: (id, pipelineId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipelines/${pipelineId}/bridges`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all trigger jobs for a specified pipeline.
    *
    * @tags pipelines
    * @name GetApiV4ProjectsIdPipelinesPipelineIdTriggerJobs
    * @summary List all trigger jobs by pipeline
    * @request GET:/api/v4/projects/{id}/pipelines/{pipeline_id}/trigger_jobs
    */
    getApiV4ProjectsIdPipelinesPipelineIdTriggerJobs: (id, pipelineId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipelines/${pipelineId}/trigger_jobs`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all pipeline variables for a specified pipeline. Use the `page` and `per_page` pagination parameters to control the pagination of results.
    *
    * @tags pipelines
    * @name GetApiV4ProjectsIdPipelinesPipelineIdVariables
    * @summary List all pipeline variables
    * @request GET:/api/v4/projects/{id}/pipelines/{pipeline_id}/variables
    */
    getApiV4ProjectsIdPipelinesPipelineIdVariables: (id, pipelineId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipelines/${pipelineId}/variables`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a test report for a pipeline.
    *
    * @tags pipelines
    * @name GetApiV4ProjectsIdPipelinesPipelineIdTestReport
    * @summary Retrieve a test report for a pipeline
    * @request GET:/api/v4/projects/{id}/pipelines/{pipeline_id}/test_report
    */
    getApiV4ProjectsIdPipelinesPipelineIdTestReport: (id, pipelineId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipelines/${pipelineId}/test_report`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a test report summary for a pipeline.
    *
    * @tags pipelines
    * @name GetApiV4ProjectsIdPipelinesPipelineIdTestReportSummary
    * @summary Retrieve a test report summary for a pipeline
    * @request GET:/api/v4/projects/{id}/pipelines/{pipeline_id}/test_report_summary
    */
    getApiV4ProjectsIdPipelinesPipelineIdTestReportSummary: (id, pipelineId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipelines/${pipelineId}/test_report_summary`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates pipeline metadata. The metadata contains the name of the pipeline. This feature was introduced in GitLab 16.6.
    *
    * @tags pipelines
    * @name PutApiV4ProjectsIdPipelinesPipelineIdMetadata
    * @summary Update pipeline metadata
    * @request PUT:/api/v4/projects/{id}/pipelines/{pipeline_id}/metadata
    */
    putApiV4ProjectsIdPipelinesPipelineIdMetadata: (id, pipelineId, putApiV4ProjectsIdPipelinesPipelineIdMetadata, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipelines/${pipelineId}/metadata`,
      method: "PUT",
      body: putApiV4ProjectsIdPipelinesPipelineIdMetadata,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retries failed or canceled jobs in a pipeline. If there are no failed or canceled jobs in the pipeline, calling this endpoint has no effect.
    *
    * @tags pipelines
    * @name PostApiV4ProjectsIdPipelinesPipelineIdRetry
    * @summary Retry jobs in a pipeline
    * @request POST:/api/v4/projects/{id}/pipelines/{pipeline_id}/retry
    */
    postApiV4ProjectsIdPipelinesPipelineIdRetry: (id, pipelineId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipelines/${pipelineId}/retry`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Cancels all jobs in a specified pipeline.
    *
    * @tags pipelines
    * @name PostApiV4ProjectsIdPipelinesPipelineIdCancel
    * @summary Cancel all jobs for a pipeline
    * @request POST:/api/v4/projects/{id}/pipelines/{pipeline_id}/cancel
    */
    postApiV4ProjectsIdPipelinesPipelineIdCancel: (id, pipelineId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipelines/${pipelineId}/cancel`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all pipeline schedules for a project.
    *
    * @tags pipeline_schedules
    * @name GetApiV4ProjectsIdPipelineSchedules
    * @summary List all pipeline schedules
    * @request GET:/api/v4/projects/{id}/pipeline_schedules
    */
    getApiV4ProjectsIdPipelineSchedules: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipeline_schedules`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a pipeline schedule.
    *
    * @tags pipeline_schedules
    * @name PostApiV4ProjectsIdPipelineSchedules
    * @summary Create a pipeline schedule
    * @request POST:/api/v4/projects/{id}/pipeline_schedules
    */
    postApiV4ProjectsIdPipelineSchedules: (id, postApiV4ProjectsIdPipelineSchedules, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipeline_schedules`,
      method: "POST",
      body: postApiV4ProjectsIdPipelineSchedules,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a pipeline schedule for a project.
    *
    * @tags pipeline_schedules
    * @name GetApiV4ProjectsIdPipelineSchedulesPipelineScheduleId
    * @summary Retrieve a pipeline schedule
    * @request GET:/api/v4/projects/{id}/pipeline_schedules/{pipeline_schedule_id}
    */
    getApiV4ProjectsIdPipelineSchedulesPipelineScheduleId: (id, pipelineScheduleId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipeline_schedules/${pipelineScheduleId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a pipeline schedule for a project. After the update is done, it is rescheduled automatically.
    *
    * @tags pipeline_schedules
    * @name PutApiV4ProjectsIdPipelineSchedulesPipelineScheduleId
    * @summary Update a pipeline schedule
    * @request PUT:/api/v4/projects/{id}/pipeline_schedules/{pipeline_schedule_id}
    */
    putApiV4ProjectsIdPipelineSchedulesPipelineScheduleId: (id, pipelineScheduleId, putApiV4ProjectsIdPipelineSchedulesPipelineScheduleId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipeline_schedules/${pipelineScheduleId}`,
      method: "PUT",
      body: putApiV4ProjectsIdPipelineSchedulesPipelineScheduleId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a pipeline schedule for a project.
    *
    * @tags pipeline_schedules
    * @name DeleteApiV4ProjectsIdPipelineSchedulesPipelineScheduleId
    * @summary Delete a pipeline schedule
    * @request DELETE:/api/v4/projects/{id}/pipeline_schedules/{pipeline_schedule_id}
    */
    deleteApiV4ProjectsIdPipelineSchedulesPipelineScheduleId: (id, pipelineScheduleId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipeline_schedules/${pipelineScheduleId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all pipelines triggered by a pipeline schedule in a project.
    *
    * @tags pipeline_schedules
    * @name GetApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdPipelines
    * @summary List all pipelines triggered by a pipeline schedule
    * @request GET:/api/v4/projects/{id}/pipeline_schedules/{pipeline_schedule_id}/pipelines
    */
    getApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdPipelines: (id, pipelineScheduleId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipeline_schedules/${pipelineScheduleId}/pipelines`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the owner of a pipeline schedule for a project.
    *
    * @tags pipeline_schedules
    * @name PostApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdTakeOwnership
    * @summary Create or update ownership of a pipeline schedule
    * @request POST:/api/v4/projects/{id}/pipeline_schedules/{pipeline_schedule_id}/take_ownership
    */
    postApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdTakeOwnership: (id, pipelineScheduleId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipeline_schedules/${pipelineScheduleId}/take_ownership`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Runs a pipeline schedule immediately. The next scheduled run of this pipeline is not affected.
    *
    * @tags pipeline_schedules
    * @name PostApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdPlay
    * @summary Run a pipeline schedule
    * @request POST:/api/v4/projects/{id}/pipeline_schedules/{pipeline_schedule_id}/play
    */
    postApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdPlay: (id, pipelineScheduleId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipeline_schedules/${pipelineScheduleId}/play`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Creates a variable for a pipeline schedule.
    *
    * @tags pipeline_schedules
    * @name PostApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdVariables
    * @summary Create a variable for a pipeline schedule
    * @request POST:/api/v4/projects/{id}/pipeline_schedules/{pipeline_schedule_id}/variables
    */
    postApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdVariables: (id, pipelineScheduleId, postApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdVariables, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipeline_schedules/${pipelineScheduleId}/variables`,
      method: "POST",
      body: postApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdVariables,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified variable for a pipeline schedule.
    *
    * @tags pipeline_schedules
    * @name GetApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdVariablesKey
    * @summary Retrieve a variable for a pipeline schedule
    * @request GET:/api/v4/projects/{id}/pipeline_schedules/{pipeline_schedule_id}/variables/{key}
    */
    getApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdVariablesKey: (id, pipelineScheduleId, key, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipeline_schedules/${pipelineScheduleId}/variables/${key}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a variable for a pipeline schedule.
    *
    * @tags pipeline_schedules
    * @name PutApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdVariablesKey
    * @summary Update a variable for a pipeline schedule
    * @request PUT:/api/v4/projects/{id}/pipeline_schedules/{pipeline_schedule_id}/variables/{key}
    */
    putApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdVariablesKey: (id, pipelineScheduleId, key, putApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdVariablesKey, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipeline_schedules/${pipelineScheduleId}/variables/${key}`,
      method: "PUT",
      body: putApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdVariablesKey,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified variable for a pipeline schedule.
    *
    * @tags pipeline_schedules
    * @name DeleteApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdVariablesKey
    * @summary Delete a variable for a pipeline schedule
    * @request DELETE:/api/v4/projects/{id}/pipeline_schedules/{pipeline_schedule_id}/variables/{key}
    */
    deleteApiV4ProjectsIdPipelineSchedulesPipelineScheduleIdVariablesKey: (id, pipelineScheduleId, key, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pipeline_schedules/${pipelineScheduleId}/variables/${key}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description Triggers a pipeline with a token. With a CI/CD job token, the triggered pipeline is a multi-project pipeline. The job that authenticates the request becomes associated with the upstream pipeline, which is visible on the pipeline graph. If you use a trigger token in a job, the job is not associated with the upstream pipeline.
    *
    * @tags ci_triggers
    * @name PostApiV4ProjectsIdRefRefTriggerPipeline
    * @summary Trigger a pipeline with a token
    * @request POST:/api/v4/projects/{id}/(ref/{ref}/)trigger/pipeline
    */
    postApiV4ProjectsIdRefRefTriggerPipeline: (id, ref, postApiV4ProjectsIdRefReftriggerPipeline, params = {}) => this.request({
      path: `/api/v4/projects/${id}/(ref/${ref}/)trigger/pipeline`,
      method: "POST",
      body: postApiV4ProjectsIdRefReftriggerPipeline,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all pipeline trigger tokens for a specified project.
    *
    * @tags ci_triggers
    * @name GetApiV4ProjectsIdTriggers
    * @summary List all project trigger tokens
    * @request GET:/api/v4/projects/{id}/triggers
    */
    getApiV4ProjectsIdTriggers: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/triggers`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a pipeline trigger token for a project.
    *
    * @tags ci_triggers
    * @name PostApiV4ProjectsIdTriggers
    * @summary Create a trigger token
    * @request POST:/api/v4/projects/{id}/triggers
    */
    postApiV4ProjectsIdTriggers: (id, postApiV4ProjectsIdTriggers, params = {}) => this.request({
      path: `/api/v4/projects/${id}/triggers`,
      method: "POST",
      body: postApiV4ProjectsIdTriggers,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves details of a pipeline trigger token for a project.
    *
    * @tags ci_triggers
    * @name GetApiV4ProjectsIdTriggersTriggerId
    * @summary Retrieve trigger token details
    * @request GET:/api/v4/projects/{id}/triggers/{trigger_id}
    */
    getApiV4ProjectsIdTriggersTriggerId: (id, triggerId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/triggers/${triggerId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a pipeline trigger token for a project.
    *
    * @tags ci_triggers
    * @name PutApiV4ProjectsIdTriggersTriggerId
    * @summary Update a pipeline trigger token
    * @request PUT:/api/v4/projects/{id}/triggers/{trigger_id}
    */
    putApiV4ProjectsIdTriggersTriggerId: (id, triggerId, putApiV4ProjectsIdTriggersTriggerId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/triggers/${triggerId}`,
      method: "PUT",
      body: putApiV4ProjectsIdTriggersTriggerId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a pipeline trigger token for a project.
    *
    * @tags ci_triggers
    * @name DeleteApiV4ProjectsIdTriggersTriggerId
    * @summary Delete a pipeline trigger token
    * @request DELETE:/api/v4/projects/{id}/triggers/{trigger_id}
    */
    deleteApiV4ProjectsIdTriggersTriggerId: (id, triggerId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/triggers/${triggerId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all variables for a project. Use the `page` and `per_page` pagination parameters to control the pagination of results.
    *
    * @tags ci_variables
    * @name GetApiV4ProjectsIdVariables
    * @summary List all project variables
    * @request GET:/api/v4/projects/{id}/variables
    */
    getApiV4ProjectsIdVariables: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/variables`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a variable. If a variable with the same `key` already exists, the variable must have a different `environment_scope`. Otherwise, GitLab returns a message similar to: `VARIABLE_NAME has already been taken`.
    *
    * @tags ci_variables
    * @name PostApiV4ProjectsIdVariables
    * @summary Create a variable
    * @request POST:/api/v4/projects/{id}/variables
    */
    postApiV4ProjectsIdVariables: (id, postApiV4ProjectsIdVariables, params = {}) => this.request({
      path: `/api/v4/projects/${id}/variables`,
      method: "POST",
      body: postApiV4ProjectsIdVariables,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves details of a specified variable. If there are multiple variables with the same key, use `filter` to select the correct `environment_scope`.
    *
    * @tags ci_variables
    * @name GetApiV4ProjectsIdVariablesKey
    * @summary Retrieve a single variable
    * @request GET:/api/v4/projects/{id}/variables/{key}
    */
    getApiV4ProjectsIdVariablesKey: (id, key, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/variables/${key}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Updates a project variable. If there are multiple variables with the same key, use `filter` to select the correct `environment_scope`.
    *
    * @tags ci_variables
    * @name PutApiV4ProjectsIdVariablesKey
    * @summary Update a variable
    * @request PUT:/api/v4/projects/{id}/variables/{key}
    */
    putApiV4ProjectsIdVariablesKey: (id, key, putApiV4ProjectsIdVariablesKey, params = {}) => this.request({
      path: `/api/v4/projects/${id}/variables/${key}`,
      method: "PUT",
      body: putApiV4ProjectsIdVariablesKey,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a project variable. If there are multiple variables with the same key, use `filter` to select the correct `environment_scope`.
    *
    * @tags ci_variables
    * @name DeleteApiV4ProjectsIdVariablesKey
    * @summary Delete a variable
    * @request DELETE:/api/v4/projects/{id}/variables/{key}
    */
    deleteApiV4ProjectsIdVariablesKey: (id, key, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/variables/${key}`,
      method: "DELETE",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all active tokens for an agent. You must have the Developer, Maintainer, or Owner role to use this endpoint.
    *
    * @tags cluster_agents
    * @name GetApiV4ProjectsIdClusterAgentsAgentIdTokens
    * @summary List all agent tokens
    * @request GET:/api/v4/projects/{id}/cluster_agents/{agent_id}/tokens
    */
    getApiV4ProjectsIdClusterAgentsAgentIdTokens: (id, agentId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/cluster_agents/${agentId}/tokens`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a token for an agent. You must have the Maintainer or Owner role to use this endpoint. An agent can have only two active tokens at one time.
    *
    * @tags cluster_agents
    * @name PostApiV4ProjectsIdClusterAgentsAgentIdTokens
    * @summary Create an agent token
    * @request POST:/api/v4/projects/{id}/cluster_agents/{agent_id}/tokens
    */
    postApiV4ProjectsIdClusterAgentsAgentIdTokens: (id, agentId, postApiV4ProjectsIdClusterAgentsAgentIdTokens, params = {}) => this.request({
      path: `/api/v4/projects/${id}/cluster_agents/${agentId}/tokens`,
      method: "POST",
      body: postApiV4ProjectsIdClusterAgentsAgentIdTokens,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified agent token. You must have the Developer, Maintainer, or Owner role to use this endpoint. Returns a `404` if the agent token has been revoked.
    *
    * @tags cluster_agents
    * @name GetApiV4ProjectsIdClusterAgentsAgentIdTokensTokenId
    * @summary Retrieve an agent token
    * @request GET:/api/v4/projects/{id}/cluster_agents/{agent_id}/tokens/{token_id}
    */
    getApiV4ProjectsIdClusterAgentsAgentIdTokensTokenId: (id, agentId, tokenId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/cluster_agents/${agentId}/tokens/${tokenId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Revokes an agent token. You must have the Maintainer or Owner role to use this endpoint.
    *
    * @tags cluster_agents
    * @name DeleteApiV4ProjectsIdClusterAgentsAgentIdTokensTokenId
    * @summary Revoke an agent token
    * @request DELETE:/api/v4/projects/{id}/cluster_agents/{agent_id}/tokens/{token_id}
    */
    deleteApiV4ProjectsIdClusterAgentsAgentIdTokensTokenId: (id, agentId, tokenId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/cluster_agents/${agentId}/tokens/${tokenId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all agents registered for the project. You must have the Developer, Maintainer, or Owner role to use this endpoint.
    *
    * @tags cluster_agents
    * @name GetApiV4ProjectsIdClusterAgents
    * @summary List all agents
    * @request GET:/api/v4/projects/{id}/cluster_agents
    */
    getApiV4ProjectsIdClusterAgents: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/cluster_agents`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates an agent for the project. You must have the Maintainer or Owner role to use this endpoint.
    *
    * @tags cluster_agents
    * @name PostApiV4ProjectsIdClusterAgents
    * @summary Create an agent
    * @request POST:/api/v4/projects/{id}/cluster_agents
    */
    postApiV4ProjectsIdClusterAgents: (id, postApiV4ProjectsIdClusterAgents, params = {}) => this.request({
      path: `/api/v4/projects/${id}/cluster_agents`,
      method: "POST",
      body: postApiV4ProjectsIdClusterAgents,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves details on a specified agent. You must have the Developer, Maintainer, or Owner role to use this endpoint.
    *
    * @tags cluster_agents
    * @name GetApiV4ProjectsIdClusterAgentsAgentId
    * @summary Retrieve details on an agent
    * @request GET:/api/v4/projects/{id}/cluster_agents/{agent_id}
    */
    getApiV4ProjectsIdClusterAgentsAgentId: (id, agentId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/cluster_agents/${agentId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes an existing agent registration. You must have the Maintainer or Owner role to use this endpoint.
    *
    * @tags cluster_agents
    * @name DeleteApiV4ProjectsIdClusterAgentsAgentId
    * @summary Delete an agent
    * @request DELETE:/api/v4/projects/{id}/cluster_agents/{agent_id}
    */
    deleteApiV4ProjectsIdClusterAgentsAgentId: (id, agentId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/cluster_agents/${agentId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description This will be used by cargo for further requests
    *
    * @tags packages_cargo
    * @name GetApiV4ProjectsIdPackagesCargoConfigJson
    * @summary Get config.json
    * @request GET:/api/v4/projects/{id}/packages/cargo/config.json
    */
    getApiV4ProjectsIdPackagesCargoConfigJson: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/cargo/config.json`,
      method: "GET",
      ...params
    }),
    /**
    * @description Returns newline-delimited JSON, one line per published version, most recently published first. Limited to the 500 most recently published versions.
    *
    * @tags packages_cargo
    * @name GetApiV4ProjectsIdPackagesCargo1PackageName
    * @summary Get the sparse index for a Cargo crate (1-character name)
    * @request GET:/api/v4/projects/{id}/packages/cargo/1/{package_name}
    */
    getApiV4ProjectsIdPackagesCargo1PackageName: (id, packageName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/cargo/1/${packageName}`,
      method: "GET",
      ...params
    }),
    /**
    * @description Returns newline-delimited JSON, one line per published version, most recently published first. Limited to the 500 most recently published versions.
    *
    * @tags packages_cargo
    * @name GetApiV4ProjectsIdPackagesCargo2PackageName
    * @summary Get the sparse index for a Cargo crate (2-character name)
    * @request GET:/api/v4/projects/{id}/packages/cargo/2/{package_name}
    */
    getApiV4ProjectsIdPackagesCargo2PackageName: (id, packageName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/cargo/2/${packageName}`,
      method: "GET",
      ...params
    }),
    /**
    * @description Returns newline-delimited JSON, one line per published version, most recently published first. Limited to the 500 most recently published versions.
    *
    * @tags packages_cargo
    * @name GetApiV4ProjectsIdPackagesCargo3FirstCharPackageName
    * @summary Get the sparse index for a Cargo crate (3-character name)
    * @request GET:/api/v4/projects/{id}/packages/cargo/3/{first_char}/{package_name}
    */
    getApiV4ProjectsIdPackagesCargo3FirstCharPackageName: (id, firstChar, packageName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/cargo/3/${firstChar}/${packageName}`,
      method: "GET",
      ...params
    }),
    /**
    * @description Returns newline-delimited JSON, one line per published version, most recently published first. Limited to the 500 most recently published versions.
    *
    * @tags packages_cargo
    * @name GetApiV4ProjectsIdPackagesCargoPrefix1Prefix2PackageName
    * @summary Get the sparse index for a Cargo crate (4+ character name)
    * @request GET:/api/v4/projects/{id}/packages/cargo/{prefix_1}/{prefix_2}/{package_name}
    */
    getApiV4ProjectsIdPackagesCargoPrefix1Prefix2PackageName: (id, prefix1, prefix2, packageName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/cargo/${prefix1}/${prefix2}/${packageName}`,
      method: "GET",
      ...params
    }),
    /**
    * @description This endpoint serves the .crate file for a given package name and version
    *
    * @tags packages_cargo
    * @name GetApiV4ProjectsIdPackagesCargoPackageNamePackageVersionDownload
    * @summary Download a Cargo crate
    * @request GET:/api/v4/projects/{id}/packages/cargo/{package_name}/{package_version}/download
    */
    getApiV4ProjectsIdPackagesCargoPackageNamePackageVersionDownload: (id, packageName, packageVersion, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/cargo/${packageName}/${packageVersion}/download`,
      method: "GET",
      ...params
    }),
    /**
    * @description Lists all commits for a specified project repository.
    *
    * @tags commits
    * @name GetApiV4ProjectsIdRepositoryCommits
    * @summary List all repository commits
    * @request GET:/api/v4/projects/{id}/repository/commits
    */
    getApiV4ProjectsIdRepositoryCommits: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/commits`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 8.13
    *
    * @tags commits
    * @name PostApiV4ProjectsIdRepositoryCommits
    * @summary Create a commit
    * @request POST:/api/v4/projects/{id}/repository/commits
    */
    postApiV4ProjectsIdRepositoryCommits: (id, postApiV4ProjectsIdRepositoryCommits, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/commits`,
      method: "POST",
      body: postApiV4ProjectsIdRepositoryCommits,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified commit identified by the commit hash or name of a branch or tag.
    *
    * @tags commits
    * @name GetApiV4ProjectsIdRepositoryCommitsSha
    * @summary Retrieve a commit
    * @request GET:/api/v4/projects/{id}/repository/commits/{sha}
    */
    getApiV4ProjectsIdRepositoryCommitsSha: (id, sha, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/commits/${sha}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the diff of a commit in a project.
    *
    * @tags commits
    * @name GetApiV4ProjectsIdRepositoryCommitsShaDiff
    * @summary Retrieve a commit diff
    * @request GET:/api/v4/projects/{id}/repository/commits/{sha}/diff
    */
    getApiV4ProjectsIdRepositoryCommitsShaDiff: (id, sha, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/commits/${sha}/diff`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all the comments of a commit in a project.
    *
    * @tags commits
    * @name GetApiV4ProjectsIdRepositoryCommitsShaComments
    * @summary List all commit comments
    * @request GET:/api/v4/projects/{id}/repository/commits/{sha}/comments
    */
    getApiV4ProjectsIdRepositoryCommitsShaComments: (id, sha, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/commits/${sha}/comments`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a comment on a commit. To comment on a specific line in a file, specify the full commit SHA, `path`, `line`, and set `line_type` to `new`.
    *
    * @tags commits
    * @name PostApiV4ProjectsIdRepositoryCommitsShaComments
    * @summary Create a comment on a commit
    * @request POST:/api/v4/projects/{id}/repository/commits/{sha}/comments
    */
    postApiV4ProjectsIdRepositoryCommitsShaComments: (id, sha, postApiV4ProjectsIdRepositoryCommitsShaComments, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/commits/${sha}/comments`,
      method: "POST",
      body: postApiV4ProjectsIdRepositoryCommitsShaComments,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the commit sequence for a specified commit.
    *
    * @tags commits
    * @name GetApiV4ProjectsIdRepositoryCommitsShaSequence
    * @summary Retrieve a commit sequence
    * @request GET:/api/v4/projects/{id}/repository/commits/{sha}/sequence
    */
    getApiV4ProjectsIdRepositoryCommitsShaSequence: (id, sha, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/commits/${sha}/sequence`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Cherry-picks a commit to a specified branch.
    *
    * @tags commits
    * @name PostApiV4ProjectsIdRepositoryCommitsShaCherryPick
    * @summary Cherry-pick a commit
    * @request POST:/api/v4/projects/{id}/repository/commits/{sha}/cherry_pick
    */
    postApiV4ProjectsIdRepositoryCommitsShaCherryPick: (id, sha, postApiV4ProjectsIdRepositoryCommitsShaCherryPick, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/commits/${sha}/cherry_pick`,
      method: "POST",
      body: postApiV4ProjectsIdRepositoryCommitsShaCherryPick,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Reverts a commit in a specified branch.
    *
    * @tags commits
    * @name PostApiV4ProjectsIdRepositoryCommitsShaRevert
    * @summary Revert a commit
    * @request POST:/api/v4/projects/{id}/repository/commits/{sha}/revert
    */
    postApiV4ProjectsIdRepositoryCommitsShaRevert: (id, sha, postApiV4ProjectsIdRepositoryCommitsShaRevert, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/commits/${sha}/revert`,
      method: "POST",
      body: postApiV4ProjectsIdRepositoryCommitsShaRevert,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all references (from branches or tags) a commit is pushed to. The pagination parameters `page` and `per_page` can be used to restrict the list of references.
    *
    * @tags commits
    * @name GetApiV4ProjectsIdRepositoryCommitsShaRefs
    * @summary List all references a commit is pushed to
    * @request GET:/api/v4/projects/{id}/repository/commits/{sha}/refs
    */
    getApiV4ProjectsIdRepositoryCommitsShaRefs: (id, sha, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/commits/${sha}/refs`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all merge requests associated with a specified commit.
    *
    * @tags commits
    * @name GetApiV4ProjectsIdRepositoryCommitsShaMergeRequests
    * @summary List all merge requests associated with a commit
    * @request GET:/api/v4/projects/{id}/repository/commits/{sha}/merge_requests
    */
    getApiV4ProjectsIdRepositoryCommitsShaMergeRequests: (id, sha, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/commits/${sha}/merge_requests`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the signature from a commit, if it is signed. For unsigned commits, it results in a 404 response.
    *
    * @tags commits
    * @name GetApiV4ProjectsIdRepositoryCommitsShaSignature
    * @summary Retrieve a commit signature
    * @request GET:/api/v4/projects/{id}/repository/commits/{sha}/signature
    */
    getApiV4ProjectsIdRepositoryCommitsShaSignature: (id, sha, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/commits/${sha}/signature`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all commit statuses for a specified project.
    *
    * @tags commit_statuses
    * @name GetApiV4ProjectsIdRepositoryCommitsShaStatuses
    * @summary List all commit statuses
    * @request GET:/api/v4/projects/{id}/repository/commits/{sha}/statuses
    */
    getApiV4ProjectsIdRepositoryCommitsShaStatuses: (id, sha, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/commits/${sha}/statuses`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the status of a commit represented by a job in an `external` stage. If the commit is associated with a merge request, target the commit in the merge request source branch.
    *
    * @tags commit_statuses
    * @name PostApiV4ProjectsIdStatusesSha
    * @summary Create or update a commit pipeline status
    * @request POST:/api/v4/projects/{id}/statuses/{sha}
    */
    postApiV4ProjectsIdStatusesSha: (id, sha, postApiV4ProjectsIdStatusesSha, params = {}) => this.request({
      path: `/api/v4/projects/${id}/statuses/${sha}`,
      method: "POST",
      body: postApiV4ProjectsIdStatusesSha,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a Composer package from a specified Git tag or branch for a project.
    *
    * @tags packages_composer
    * @name PostApiV4ProjectsIdPackagesComposer
    * @summary Create a package
    * @request POST:/api/v4/projects/{id}/packages/composer
    */
    postApiV4ProjectsIdPackagesComposer: (id, postApiV4ProjectsIdPackagesComposer, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/composer`,
      method: "POST",
      body: postApiV4ProjectsIdPackagesComposer,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.1
    *
    * @tags packages_composer
    * @name GetApiV4ProjectsIdPackagesComposerArchivesPackageName
    * @summary Composer package endpoint to download a package archive
    * @request GET:/api/v4/projects/{id}/packages/composer/archives/*package_name
    */
    getApiV4ProjectsIdPackagesComposerArchivesPackageName: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/composer/archives/*package_name`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Retrieves an authentication token. Creates a JSON Web Token (JWT) for use as a Bearer header in other requests to the package registry.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV1UsersAuthenticate
    * @summary Retrieve an authentication token
    * @request GET:/api/v4/projects/{id}/packages/conan/v1/users/authenticate
    */
    getApiV4ProjectsIdPackagesConanV1UsersAuthenticate: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/users/authenticate`,
      method: "GET",
      ...params
    }),
    /**
    * @description Verifies authentication credentials for a Conan package registry.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV1UsersCheckCredentials
    * @summary Verify authentication credentials
    * @request GET:/api/v4/projects/{id}/packages/conan/v1/users/check_credentials
    */
    getApiV4ProjectsIdPackagesConanV1UsersCheckCredentials: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/users/check_credentials`,
      method: "GET",
      ...params
    }),
    /**
    * @description Searches the instance for a specified Conan package.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV1ConansSearch
    * @summary Search for a Conan package
    * @request GET:/api/v4/projects/{id}/packages/conan/v1/conans/search
    */
    getApiV4ProjectsIdPackagesConanV1ConansSearch: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/conans/search`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Retrieves the metadata for all package references of a specified package. This feature was introduced in GitLab 18.0.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelSearch
    * @summary Retrieve package references metadata
    * @request GET:/api/v4/projects/{id}/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/search
    */
    getApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelSearch: (id, packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/search`,
      method: "GET",
      ...params
    }),
    /**
    * @description Verifies availability of a Conan repository.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV1Ping
    * @summary Verify availability of a Conan repository
    * @request GET:/api/v4/projects/{id}/packages/conan/v1/ping
    */
    getApiV4ProjectsIdPackagesConanV1Ping: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/ping`,
      method: "GET",
      ...params
    }),
    /**
    * @description Retrieves a snapshot of the files for a specified Conan package and reference. The snapshot is a list of filenames with their associated MD5 hash.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReference
    * @summary Retrieve a package snapshot
    * @request GET:/api/v4/projects/{id}/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/packages/{conan_package_reference}
    */
    getApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReference: (id, packageName, packageVersion, packageUsername, packageChannel, conanPackageReference, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/packages/${conanPackageReference}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a snapshot of the files for a specified Conan recipe. The snapshot is a list of filenames with their associated MD5 hash.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannel
    * @summary Retrieve a recipe snapshot
    * @request GET:/api/v4/projects/{id}/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}
    */
    getApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannel: (id, packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified Conan recipe and associated package files from the package registry.
    *
    * @tags packages_conan
    * @name DeleteApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannel
    * @summary Delete a recipe and package
    * @request DELETE:/api/v4/projects/{id}/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}
    */
    deleteApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannel: (id, packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Retrieves a manifest that includes a list of files and associated download URLs for a specified package.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReferenceDigest
    * @summary Retrieve a package manifest
    * @request GET:/api/v4/projects/{id}/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/packages/{conan_package_reference}/digest
    */
    getApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReferenceDigest: (id, packageName, packageVersion, packageUsername, packageChannel, conanPackageReference, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/packages/${conanPackageReference}/digest`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a manifest that includes a list of files and associated download URLs for a specified recipe.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelDigest
    * @summary Retrieve a recipe manifest
    * @request GET:/api/v4/projects/{id}/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/digest
    */
    getApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelDigest: (id, packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/digest`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all files and associated download URLs for a specified package in the package registry. Returns the same payload as the package manifest endpoint.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReferenceDownloadUrls
    * @summary List all package download URLs
    * @request GET:/api/v4/projects/{id}/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/packages/{conan_package_reference}/download_urls
    */
    getApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReferenceDownloadUrls: (id, packageName, packageVersion, packageUsername, packageChannel, conanPackageReference, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/packages/${conanPackageReference}/download_urls`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all files and associated download URLs for a specified recipe in the package registry. Returns the same payload as the recipe manifest endpoint.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelDownloadUrls
    * @summary List all recipe download URLs
    * @request GET:/api/v4/projects/{id}/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/download_urls
    */
    getApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelDownloadUrls: (id, packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/download_urls`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all the upload URLs for a specified collection of package files. The request must include a JSON object with the name and size of the individual files.
    *
    * @tags packages_conan
    * @name PostApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReferenceUploadUrls
    * @summary List all package upload URLs
    * @request POST:/api/v4/projects/{id}/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/packages/{conan_package_reference}/upload_urls
    */
    postApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReferenceUploadUrls: (id, packageName, packageVersion, packageUsername, packageChannel, conanPackageReference, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/packages/${conanPackageReference}/upload_urls`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all the upload URLs for a specified collection of recipe files. The request must include a JSON object with the name and size of the individual files.
    *
    * @tags packages_conan
    * @name PostApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelUploadUrls
    * @summary List all recipe upload URLs
    * @request POST:/api/v4/projects/{id}/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/upload_urls
    */
    postApiV4ProjectsIdPackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelUploadUrls: (id, packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/upload_urls`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified recipe file from the package registry. You must use the download URL returned from the recipe download URLs endpoint.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileName
    * @summary Retrieve a recipe file
    * @request GET:/api/v4/projects/{id}/packages/conan/v1/files/{package_name}/{package_version}/{package_username}/{package_channel}/{recipe_revision}/export/{file_name}
    */
    getApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileName: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, fileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/files/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/${recipeRevision}/export/${fileName}`,
      method: "GET",
      ...params
    }),
    /**
    * @description Uploads a specified recipe file to the package registry. You must use the upload URL returned from the recipe upload URLs endpoint.
    *
    * @tags packages_conan
    * @name PutApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileName
    * @summary Upload a recipe file
    * @request PUT:/api/v4/projects/{id}/packages/conan/v1/files/{package_name}/{package_version}/{package_username}/{package_channel}/{recipe_revision}/export/{file_name}
    */
    putApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileName: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, fileName, putApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/files/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/${recipeRevision}/export/${fileName}`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileName,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Authorizes the Conan recipe file.
    *
    * @tags packages_conan
    * @name PutApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileNameAuthorize
    * @summary Workhorse authorize the Conan recipe file
    * @request PUT:/api/v4/projects/{id}/packages/conan/v1/files/{package_name}/{package_version}/{package_username}/{package_channel}/{recipe_revision}/export/{file_name}/authorize
    */
    putApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileNameAuthorize: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, fileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/files/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/${recipeRevision}/export/${fileName}/authorize`,
      method: "PUT",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Retrieves a specified package file from the package registry. You must use the download URL returned from the package download URLs endpoint.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileName
    * @summary Retrieve a package file
    * @request GET:/api/v4/projects/{id}/packages/conan/v1/files/{package_name}/{package_version}/{package_username}/{package_channel}/{recipe_revision}/package/{conan_package_reference}/{package_revision}/{file_name}
    */
    getApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileName: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, conanPackageReference, packageRevision, fileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/files/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/${recipeRevision}/package/${conanPackageReference}/${packageRevision}/${fileName}`,
      method: "GET",
      ...params
    }),
    /**
    * @description Uploads a specified package file to the package registry. You must use the upload URL returned from the package upload URLs endpoint.
    *
    * @tags packages_conan
    * @name PutApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileName
    * @summary Upload a package file
    * @request PUT:/api/v4/projects/{id}/packages/conan/v1/files/{package_name}/{package_version}/{package_username}/{package_channel}/{recipe_revision}/package/{conan_package_reference}/{package_revision}/{file_name}
    */
    putApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileName: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, conanPackageReference, packageRevision, fileName, putApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/files/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/${recipeRevision}/package/${conanPackageReference}/${packageRevision}/${fileName}`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileName,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Authorizes the Conan package file.
    *
    * @tags packages_conan
    * @name PutApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileNameAuthorize
    * @summary Workhorse authorize the Conan package file
    * @request PUT:/api/v4/projects/{id}/packages/conan/v1/files/{package_name}/{package_version}/{package_username}/{package_channel}/{recipe_revision}/package/{conan_package_reference}/{package_revision}/{file_name}/authorize
    */
    putApiV4ProjectsIdPackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileNameAuthorize: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, conanPackageReference, packageRevision, fileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v1/files/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/${recipeRevision}/package/${conanPackageReference}/${packageRevision}/${fileName}/authorize`,
      method: "PUT",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Retrieves an authentication token. Creates a JSON Web Token (JWT) for use as a Bearer header in other requests to the package registry.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV2UsersAuthenticate
    * @summary Retrieve an authentication token
    * @request GET:/api/v4/projects/{id}/packages/conan/v2/users/authenticate
    */
    getApiV4ProjectsIdPackagesConanV2UsersAuthenticate: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/users/authenticate`,
      method: "GET",
      ...params
    }),
    /**
    * @description Verifies authentication credentials for a Conan package registry.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV2UsersCheckCredentials
    * @summary Verify authentication credentials
    * @request GET:/api/v4/projects/{id}/packages/conan/v2/users/check_credentials
    */
    getApiV4ProjectsIdPackagesConanV2UsersCheckCredentials: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/users/check_credentials`,
      method: "GET",
      ...params
    }),
    /**
    * @description Searches the instance for a specified Conan package.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV2ConansSearch
    * @summary Search for a Conan package
    * @request GET:/api/v4/projects/{id}/packages/conan/v2/conans/search
    */
    getApiV4ProjectsIdPackagesConanV2ConansSearch: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/search`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Retrieves the metadata for all package references of a specified package. This feature was introduced in GitLab 18.0.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelSearch
    * @summary Retrieve package references metadata
    * @request GET:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/search
    */
    getApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelSearch: (id, packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/search`,
      method: "GET",
      ...params
    }),
    /**
    * @description Retrieves the revision hash and creation date of the latest package recipe. This feature was introduced in GitLab 17.11.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelLatest
    * @summary Retrieve latest recipe revision
    * @request GET:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/latest
    */
    getApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelLatest: (id, packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/latest`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all revisions for a package recipe. This feature was introduced in GitLab 17.11.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisions
    * @summary List all recipe revisions
    * @request GET:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/revisions
    */
    getApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisions: (id, packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/revisions`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified recipe revision from the registry. If the recipe revision is the only one, the package is deleted as well. This feature was introduced in GitLab 18.1.
    *
    * @tags packages_conan
    * @name DeleteApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevision
    * @summary Delete recipe revision
    * @request DELETE:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/revisions/{recipe_revision}
    */
    deleteApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevision: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/revisions/${recipeRevision}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all recipe files from the package registry. This feature was introduced in GitLab 17.11.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionFiles
    * @summary List all recipe files
    * @request GET:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/revisions/{recipe_revision}/files
    */
    getApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionFiles: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/revisions/${recipeRevision}/files`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified recipe file from the package registry. This feature was introduced in GitLab 17.8.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionFilesFileName
    * @summary Retrieve a recipe file
    * @request GET:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/revisions/{recipe_revision}/files/{file_name}
    */
    getApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionFilesFileName: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, fileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/revisions/${recipeRevision}/files/${fileName}`,
      method: "GET",
      ...params
    }),
    /**
    * @description Uploads a specified recipe file to the package registry. This feature was introduced in GitLab 17.10.
    *
    * @tags packages_conan
    * @name PutApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionFilesFileName
    * @summary Upload a recipe file
    * @request PUT:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/revisions/{recipe_revision}/files/{file_name}
    */
    putApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionFilesFileName: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, fileName, putApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionFilesFileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/revisions/${recipeRevision}/files/${fileName}`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionFilesFileName,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Authorizes the Conan recipe file. This feature was introduced in GitLab 17.10.
    *
    * @tags packages_conan
    * @name PutApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionFilesFileNameAuthorize
    * @summary Workhorse authorize the Conan recipe file
    * @request PUT:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/revisions/{recipe_revision}/files/{file_name}/authorize
    */
    putApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionFilesFileNameAuthorize: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, fileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/revisions/${recipeRevision}/files/${fileName}/authorize`,
      method: "PUT",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Retrieves the metadata for all package references associated with a specified recipe revision. This feature was introduced in GitLab 18.1.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionSearch
    * @summary Retrieve package references metadata by recipe revision
    * @request GET:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/revisions/{recipe_revision}/search
    */
    getApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionSearch: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/revisions/${recipeRevision}/search`,
      method: "GET",
      ...params
    }),
    /**
    * @description Retrieves the revision hash and creation date of the latest package revision for a specified recipe revision and package reference. This feature was introduced in GitLab 17.11.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceLatest
    * @summary Retrieve latest package revision
    * @request GET:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/revisions/{recipe_revision}/packages/{conan_package_reference}/latest
    */
    getApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceLatest: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, conanPackageReference, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/revisions/${recipeRevision}/packages/${conanPackageReference}/latest`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all package revisions for a specified recipe revision and package reference. This feature was introduced in GitLab 18.0.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceRevisions
    * @summary List all package revisions
    * @request GET:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/revisions/{recipe_revision}/packages/{conan_package_reference}/revisions
    */
    getApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceRevisions: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, conanPackageReference, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/revisions/${recipeRevision}/packages/${conanPackageReference}/revisions`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified package revision from the registry. If the package reference has only one package revision, the package reference is deleted as well. This feature was introduced in GitLab 18.1.
    *
    * @tags packages_conan
    * @name DeleteApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceRevisionsPackageRevision
    * @summary Delete a package revision
    * @request DELETE:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/revisions/{recipe_revision}/packages/{conan_package_reference}/revisions/{package_revision}
    */
    deleteApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceRevisionsPackageRevision: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, conanPackageReference, packageRevision, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/revisions/${recipeRevision}/packages/${conanPackageReference}/revisions/${packageRevision}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all package files. This feature was introduced in GitLab 18.0.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceRevisionsPackageRevisionFiles
    * @summary List all package files
    * @request GET:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/revisions/{recipe_revision}/packages/{conan_package_reference}/revisions/{package_revision}/files
    */
    getApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceRevisionsPackageRevisionFiles: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, conanPackageReference, packageRevision, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/revisions/${recipeRevision}/packages/${conanPackageReference}/revisions/${packageRevision}/files`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified package file from the package registry. This feature was introduced in GitLab 17.11.
    *
    * @tags packages_conan
    * @name GetApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceRevisionsPackageRevisionFilesFileName
    * @summary Retrieve a package file
    * @request GET:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/revisions/{recipe_revision}/packages/{conan_package_reference}/revisions/{package_revision}/files/{file_name}
    */
    getApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceRevisionsPackageRevisionFilesFileName: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, conanPackageReference, packageRevision, fileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/revisions/${recipeRevision}/packages/${conanPackageReference}/revisions/${packageRevision}/files/${fileName}`,
      method: "GET",
      ...params
    }),
    /**
    * @description Uploads a specified package file to the package registry. This feature was introduced in GitLab 17.11.
    *
    * @tags packages_conan
    * @name PutApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceRevisionsPackageRevisionFilesFileName
    * @summary Upload a package file
    * @request PUT:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/revisions/{recipe_revision}/packages/{conan_package_reference}/revisions/{package_revision}/files/{file_name}
    */
    putApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceRevisionsPackageRevisionFilesFileName: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, conanPackageReference, packageRevision, fileName, putApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceRevisionsPackageRevisionFilesFileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/revisions/${recipeRevision}/packages/${conanPackageReference}/revisions/${packageRevision}/files/${fileName}`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceRevisionsPackageRevisionFilesFileName,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Authorizes the Conan package file. This feature was introduced in GitLab 17.11.
    *
    * @tags packages_conan
    * @name PutApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceRevisionsPackageRevisionFilesFileNameAuthorize
    * @summary Workhorse authorize the Conan package file
    * @request PUT:/api/v4/projects/{id}/packages/conan/v2/conans/{package_name}/{package_version}/{package_username}/{package_channel}/revisions/{recipe_revision}/packages/{conan_package_reference}/revisions/{package_revision}/files/{file_name}/authorize
    */
    putApiV4ProjectsIdPackagesConanV2ConansPackageNamePackageVersionPackageUsernamePackageChannelRevisionsRecipeRevisionPackagesConanPackageReferenceRevisionsPackageRevisionFilesFileNameAuthorize: (id, packageName, packageVersion, packageUsername, packageChannel, recipeRevision, conanPackageReference, packageRevision, fileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/conan/v2/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/revisions/${recipeRevision}/packages/${conanPackageReference}/revisions/${packageRevision}/files/${fileName}/authorize`,
      method: "PUT",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.5
    *
    * @tags packages_debian
    * @name GetApiV4ProjectsIdPackagesDebianDistsDistributionReleaseGpg
    * @summary The Release file signature
    * @request GET:/api/v4/projects/{id}/packages/debian/dists/*distribution/Release.gpg
    */
    getApiV4ProjectsIdPackagesDebianDistsDistributionReleaseGpg: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/debian/dists/*distribution/Release.gpg`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.5
    *
    * @tags packages_debian
    * @name GetApiV4ProjectsIdPackagesDebianDistsDistributionRelease
    * @summary The unsigned Release file
    * @request GET:/api/v4/projects/{id}/packages/debian/dists/*distribution/Release
    */
    getApiV4ProjectsIdPackagesDebianDistsDistributionRelease: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/debian/dists/*distribution/Release`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.5
    *
    * @tags packages_debian
    * @name GetApiV4ProjectsIdPackagesDebianDistsDistributionInrelease
    * @summary The signed Release file
    * @request GET:/api/v4/projects/{id}/packages/debian/dists/*distribution/InRelease
    */
    getApiV4ProjectsIdPackagesDebianDistsDistributionInrelease: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/debian/dists/*distribution/InRelease`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.4
    *
    * @tags packages_debian
    * @name GetApiV4ProjectsIdPackagesDebianDistsDistributionComponentDebianInstallerBinaryArchitecturePackages
    * @summary The installer (udeb) binary files index
    * @request GET:/api/v4/projects/{id}/packages/debian/dists/*distribution/{component}/debian-installer/binary-{architecture}/Packages
    */
    getApiV4ProjectsIdPackagesDebianDistsDistributionComponentDebianInstallerBinaryArchitecturePackages: (id, component, architecture, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/debian/dists/*distribution/${component}/debian-installer/binary-${architecture}/Packages`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.4
    *
    * @tags packages_debian
    * @name GetApiV4ProjectsIdPackagesDebianDistsDistributionComponentDebianInstallerBinaryArchitectureByHashSha256FileSha256
    * @summary The installer (udeb) binary files index by hash
    * @request GET:/api/v4/projects/{id}/packages/debian/dists/*distribution/{component}/debian-installer/binary-{architecture}/by-hash/SHA256/{file_sha256}
    */
    getApiV4ProjectsIdPackagesDebianDistsDistributionComponentDebianInstallerBinaryArchitectureByHashSha256FileSha256: (id, component, architecture, fileSha256, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/debian/dists/*distribution/${component}/debian-installer/binary-${architecture}/by-hash/SHA256/${fileSha256}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.4
    *
    * @tags packages_debian
    * @name GetApiV4ProjectsIdPackagesDebianDistsDistributionComponentSourceSources
    * @summary The source files index
    * @request GET:/api/v4/projects/{id}/packages/debian/dists/*distribution/{component}/source/Sources
    */
    getApiV4ProjectsIdPackagesDebianDistsDistributionComponentSourceSources: (id, component, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/debian/dists/*distribution/${component}/source/Sources`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.4
    *
    * @tags packages_debian
    * @name GetApiV4ProjectsIdPackagesDebianDistsDistributionComponentSourceByHashSha256FileSha256
    * @summary The source files index by hash
    * @request GET:/api/v4/projects/{id}/packages/debian/dists/*distribution/{component}/source/by-hash/SHA256/{file_sha256}
    */
    getApiV4ProjectsIdPackagesDebianDistsDistributionComponentSourceByHashSha256FileSha256: (id, component, fileSha256, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/debian/dists/*distribution/${component}/source/by-hash/SHA256/${fileSha256}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.5
    *
    * @tags packages_debian
    * @name GetApiV4ProjectsIdPackagesDebianDistsDistributionComponentBinaryArchitecturePackages
    * @summary The binary files index
    * @request GET:/api/v4/projects/{id}/packages/debian/dists/*distribution/{component}/binary-{architecture}/Packages
    */
    getApiV4ProjectsIdPackagesDebianDistsDistributionComponentBinaryArchitecturePackages: (id, component, architecture, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/debian/dists/*distribution/${component}/binary-${architecture}/Packages`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.4
    *
    * @tags packages_debian
    * @name GetApiV4ProjectsIdPackagesDebianDistsDistributionComponentBinaryArchitectureByHashSha256FileSha256
    * @summary The binary files index by hash
    * @request GET:/api/v4/projects/{id}/packages/debian/dists/*distribution/{component}/binary-{architecture}/by-hash/SHA256/{file_sha256}
    */
    getApiV4ProjectsIdPackagesDebianDistsDistributionComponentBinaryArchitectureByHashSha256FileSha256: (id, component, architecture, fileSha256, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/debian/dists/*distribution/${component}/binary-${architecture}/by-hash/SHA256/${fileSha256}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Downloads a specified Debian package file for a project.
    *
    * @tags packages_debian
    * @name GetApiV4ProjectsIdPackagesDebianPoolDistributionLetterPackageNamePackageVersionFileName
    * @summary Download a Debian package file
    * @request GET:/api/v4/projects/{id}/packages/debian/pool/{distribution}/{letter}/{package_name}/{package_version}/{file_name}
    */
    getApiV4ProjectsIdPackagesDebianPoolDistributionLetterPackageNamePackageVersionFileName: (id, distribution, letter, packageName, packageVersion, fileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/debian/pool/${distribution}/${letter}/${packageName}/${packageVersion}/${fileName}`,
      method: "GET",
      ...params
    }),
    /**
    * @description Uploads a Debian package file for a specified project.
    *
    * @tags packages_debian
    * @name PutApiV4ProjectsIdPackagesDebianFileName
    * @summary Upload a Debian package file
    * @request PUT:/api/v4/projects/{id}/packages/debian/{file_name}
    */
    putApiV4ProjectsIdPackagesDebianFileName: (id, fileName, putApiV4ProjectsIdPackagesDebianFileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/debian/${fileName}`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesDebianFileName,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.5
    *
    * @tags packages_debian
    * @name PutApiV4ProjectsIdPackagesDebianFileNameAuthorize
    * @summary Authorize Debian package upload
    * @request PUT:/api/v4/projects/{id}/packages/debian/{file_name}/authorize
    */
    putApiV4ProjectsIdPackagesDebianFileNameAuthorize: (id, fileName, putApiV4ProjectsIdPackagesDebianFileNameAuthorize, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/debian/${fileName}/authorize`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesDebianFileNameAuthorize,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all deploy keys for a specified project.
    *
    * @tags deploy_resources
    * @name GetApiV4ProjectsIdDeployKeys
    * @summary List all deploy keys for project
    * @request GET:/api/v4/projects/{id}/deploy_keys
    */
    getApiV4ProjectsIdDeployKeys: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deploy_keys`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds a deploy key for a specified project. If the deploy key already exists in another project, it is joined to the current project only if the original one is accessible by the same user.
    *
    * @tags deploy_resources
    * @name PostApiV4ProjectsIdDeployKeys
    * @summary Add a deploy key for a project
    * @request POST:/api/v4/projects/{id}/deploy_keys
    */
    postApiV4ProjectsIdDeployKeys: (id, postApiV4ProjectsIdDeployKeys, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deploy_keys`,
      method: "POST",
      body: postApiV4ProjectsIdDeployKeys,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified deploy key.
    *
    * @tags deploy_resources
    * @name GetApiV4ProjectsIdDeployKeysKeyId
    * @summary Retrieve a deploy key
    * @request GET:/api/v4/projects/{id}/deploy_keys/{key_id}
    */
    getApiV4ProjectsIdDeployKeysKeyId: (id, keyId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deploy_keys/${keyId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a deploy key for a project.
    *
    * @tags deploy_resources
    * @name PutApiV4ProjectsIdDeployKeysKeyId
    * @summary Update a deploy key
    * @request PUT:/api/v4/projects/{id}/deploy_keys/{key_id}
    */
    putApiV4ProjectsIdDeployKeysKeyId: (id, keyId, putApiV4ProjectsIdDeployKeysKeyId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deploy_keys/${keyId}`,
      method: "PUT",
      body: putApiV4ProjectsIdDeployKeysKeyId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a deploy key from the project. If the deploy key is used only for this project, it is deleted from the system.
    *
    * @tags deploy_resources
    * @name DeleteApiV4ProjectsIdDeployKeysKeyId
    * @summary Delete a deploy key
    * @request DELETE:/api/v4/projects/{id}/deploy_keys/{key_id}
    */
    deleteApiV4ProjectsIdDeployKeysKeyId: (id, keyId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deploy_keys/${keyId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Enables a deploy key for a project so this can be used. Returns the enabled key, with a status code 201 when successful.
    *
    * @tags deploy_resources
    * @name PostApiV4ProjectsIdDeployKeysKeyIdEnable
    * @summary Enable a deploy key
    * @request POST:/api/v4/projects/{id}/deploy_keys/{key_id}/enable
    */
    postApiV4ProjectsIdDeployKeysKeyIdEnable: (id, keyId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deploy_keys/${keyId}/enable`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all project deploy tokens.
    *
    * @tags deploy_resources
    * @name GetApiV4ProjectsIdDeployTokens
    * @summary List all project deploy tokens
    * @request GET:/api/v4/projects/{id}/deploy_tokens
    */
    getApiV4ProjectsIdDeployTokens: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deploy_tokens`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a project deploy token.
    *
    * @tags deploy_resources
    * @name PostApiV4ProjectsIdDeployTokens
    * @summary Create a project deploy token
    * @request POST:/api/v4/projects/{id}/deploy_tokens
    */
    postApiV4ProjectsIdDeployTokens: (id, postApiV4ProjectsIdDeployTokens, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deploy_tokens`,
      method: "POST",
      body: postApiV4ProjectsIdDeployTokens,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a project deploy token.
    *
    * @tags deploy_resources
    * @name GetApiV4ProjectsIdDeployTokensTokenId
    * @summary Retrieve a project deploy token
    * @request GET:/api/v4/projects/{id}/deploy_tokens/{token_id}
    */
    getApiV4ProjectsIdDeployTokensTokenId: (id, tokenId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deploy_tokens/${tokenId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a project deploy token.
    *
    * @tags deploy_resources
    * @name DeleteApiV4ProjectsIdDeployTokensTokenId
    * @summary Delete a project deploy token
    * @request DELETE:/api/v4/projects/{id}/deploy_tokens/{token_id}
    */
    deleteApiV4ProjectsIdDeployTokensTokenId: (id, tokenId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deploy_tokens/${tokenId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all deployments in a project.
    *
    * @tags deploy_resources
    * @name GetApiV4ProjectsIdDeployments
    * @summary List all project deployments
    * @request GET:/api/v4/projects/{id}/deployments
    */
    getApiV4ProjectsIdDeployments: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deployments`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a deployment.
    *
    * @tags deploy_resources
    * @name PostApiV4ProjectsIdDeployments
    * @summary Create a deployment
    * @request POST:/api/v4/projects/{id}/deployments
    */
    postApiV4ProjectsIdDeployments: (id, postApiV4ProjectsIdDeployments, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deployments`,
      method: "POST",
      body: postApiV4ProjectsIdDeployments,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified deployment.
    *
    * @tags deploy_resources
    * @name GetApiV4ProjectsIdDeploymentsDeploymentId
    * @summary Retrieve a deployment
    * @request GET:/api/v4/projects/{id}/deployments/{deployment_id}
    */
    getApiV4ProjectsIdDeploymentsDeploymentId: (id, deploymentId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deployments/${deploymentId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified deployment.
    *
    * @tags deploy_resources
    * @name PutApiV4ProjectsIdDeploymentsDeploymentId
    * @summary Update a deployment
    * @request PUT:/api/v4/projects/{id}/deployments/{deployment_id}
    */
    putApiV4ProjectsIdDeploymentsDeploymentId: (id, deploymentId, putApiV4ProjectsIdDeploymentsDeploymentId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deployments/${deploymentId}`,
      method: "PUT",
      body: putApiV4ProjectsIdDeploymentsDeploymentId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified deployment that is not currently the last deployment for an environment or in a `running` state.
    *
    * @tags deploy_resources
    * @name DeleteApiV4ProjectsIdDeploymentsDeploymentId
    * @summary Delete a deployment
    * @request DELETE:/api/v4/projects/{id}/deployments/{deployment_id}
    */
    deleteApiV4ProjectsIdDeploymentsDeploymentId: (id, deploymentId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deployments/${deploymentId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all merge requests shipped with a specified deployment.
    *
    * @tags deploy_resources
    * @name GetApiV4ProjectsIdDeploymentsDeploymentIdMergeRequests
    * @summary List all merge requests associated with a deployment
    * @request GET:/api/v4/projects/{id}/deployments/{deployment_id}/merge_requests
    */
    getApiV4ProjectsIdDeploymentsDeploymentIdMergeRequests: (id, deploymentId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deployments/${deploymentId}/merge_requests`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Approves or rejects a deployment.
    *
    * @tags deploy_resources
    * @name PostApiV4ProjectsIdDeploymentsDeploymentIdApproval
    * @summary Approve or reject a deployment
    * @request POST:/api/v4/projects/{id}/deployments/{deployment_id}/approval
    */
    postApiV4ProjectsIdDeploymentsDeploymentIdApproval: (id, deploymentId, postApiV4ProjectsIdDeploymentsDeploymentIdApproval, params = {}) => this.request({
      path: `/api/v4/projects/${id}/deployments/${deploymentId}/approval`,
      method: "POST",
      body: postApiV4ProjectsIdDeploymentsDeploymentIdApproval,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all merge request draft notes.
    *
    * @tags draft_notes
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotes
    * @summary List all merge request draft notes
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/draft_notes
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotes: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/draft_notes`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates a draft note for a specified merge request.
    *
    * @tags draft_notes
    * @name PostApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotes
    * @summary Create a draft note
    * @request POST:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/draft_notes
    */
    postApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotes: (id, mergeRequestIid, postApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotes, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/draft_notes`,
      method: "POST",
      body: postApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotes,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a draft note for a specified merge request.
    *
    * @tags draft_notes
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotesDraftNoteId
    * @summary Retrieve a draft note
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/draft_notes/{draft_note_id}
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotesDraftNoteId: (id, mergeRequestIid, draftNoteId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/draft_notes/${draftNoteId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a draft note for a specified merge request.
    *
    * @tags draft_notes
    * @name PutApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotesDraftNoteId
    * @summary Update a draft note
    * @request PUT:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/draft_notes/{draft_note_id}
    */
    putApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotesDraftNoteId: (id, mergeRequestIid, draftNoteId, putApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotesDraftNoteId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/draft_notes/${draftNoteId}`,
      method: "PUT",
      body: putApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotesDraftNoteId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a draft note for a specified merge request.
    *
    * @tags draft_notes
    * @name DeleteApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotesDraftNoteId
    * @summary Delete a draft note
    * @request DELETE:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/draft_notes/{draft_note_id}
    */
    deleteApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotesDraftNoteId: (id, mergeRequestIid, draftNoteId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/draft_notes/${draftNoteId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Publishes a draft note for a specified merge request.
    *
    * @tags draft_notes
    * @name PutApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotesDraftNoteIdPublish
    * @summary Publish a draft note
    * @request PUT:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/draft_notes/{draft_note_id}/publish
    */
    putApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotesDraftNoteIdPublish: (id, mergeRequestIid, draftNoteId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/draft_notes/${draftNoteId}/publish`,
      method: "PUT",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Publishes all pending draft notes for the current user on the specified merge request. Optionally sets the reviewer state and posts a summary note.
    *
    * @tags draft_notes
    * @name PostApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotesBulkPublish
    * @summary Publish all pending draft notes
    * @request POST:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/draft_notes/bulk_publish
    */
    postApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotesBulkPublish: (id, mergeRequestIid, postApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotesBulkPublish, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/draft_notes/bulk_publish`,
      method: "POST",
      body: postApiV4ProjectsIdMergeRequestsMergeRequestIidDraftNotesBulkPublish,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all environments for a specified project.
    *
    * @tags environments
    * @name GetApiV4ProjectsIdEnvironments
    * @summary List all environments
    * @request GET:/api/v4/projects/{id}/environments
    */
    getApiV4ProjectsIdEnvironments: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/environments`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates an environment for a specified project.
    *
    * @tags environments
    * @name PostApiV4ProjectsIdEnvironments
    * @summary Create an environment
    * @request POST:/api/v4/projects/{id}/environments
    */
    postApiV4ProjectsIdEnvironments: (id, postApiV4ProjectsIdEnvironments, params = {}) => this.request({
      path: `/api/v4/projects/${id}/environments`,
      method: "POST",
      body: postApiV4ProjectsIdEnvironments,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Updates an existing environment for a project.
    *
    * @tags environments
    * @name PutApiV4ProjectsIdEnvironmentsEnvironmentId
    * @summary Update an existing environment
    * @request PUT:/api/v4/projects/{id}/environments/{environment_id}
    */
    putApiV4ProjectsIdEnvironmentsEnvironmentId: (id, environmentId, putApiV4ProjectsIdEnvironmentsEnvironmentId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/environments/${environmentId}`,
      method: "PUT",
      body: putApiV4ProjectsIdEnvironmentsEnvironmentId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes an environment from a project. The environment must be stopped first.
    *
    * @tags environments
    * @name DeleteApiV4ProjectsIdEnvironmentsEnvironmentId
    * @summary Delete an environment
    * @request DELETE:/api/v4/projects/{id}/environments/{environment_id}
    */
    deleteApiV4ProjectsIdEnvironmentsEnvironmentId: (id, environmentId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/environments/${environmentId}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified environment for a project.
    *
    * @tags environments
    * @name GetApiV4ProjectsIdEnvironmentsEnvironmentId
    * @summary Retrieve an environment
    * @request GET:/api/v4/projects/{id}/environments/{environment_id}
    */
    getApiV4ProjectsIdEnvironmentsEnvironmentId: (id, environmentId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/environments/${environmentId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Schedules multiple stopped review apps for deletion. The deletion is performed after 1 week. By default, only environments 30 days or older are deleted.
    *
    * @tags environments
    * @name DeleteApiV4ProjectsIdEnvironmentsReviewApps
    * @summary Schedule multiple stopped review apps for deletion
    * @request DELETE:/api/v4/projects/{id}/environments/review_apps
    */
    deleteApiV4ProjectsIdEnvironmentsReviewApps: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/environments/review_apps`,
      method: "DELETE",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Stops a specified running environment.
    *
    * @tags environments
    * @name PostApiV4ProjectsIdEnvironmentsEnvironmentIdStop
    * @summary Stop an environment
    * @request POST:/api/v4/projects/{id}/environments/{environment_id}/stop
    */
    postApiV4ProjectsIdEnvironmentsEnvironmentIdStop: (id, environmentId, postApiV4ProjectsIdEnvironmentsEnvironmentIdStop, params = {}) => this.request({
      path: `/api/v4/projects/${id}/environments/${environmentId}/stop`,
      method: "POST",
      body: postApiV4ProjectsIdEnvironmentsEnvironmentIdStop,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Stops all environments that were last modified or deployed to before a specified date. Excludes protected environments.
    *
    * @tags environments
    * @name PostApiV4ProjectsIdEnvironmentsStopStale
    * @summary Stop stale environments
    * @request POST:/api/v4/projects/{id}/environments/stop_stale
    */
    postApiV4ProjectsIdEnvironmentsStopStale: (id, postApiV4ProjectsIdEnvironmentsStopStale, params = {}) => this.request({
      path: `/api/v4/projects/${id}/environments/stop_stale`,
      method: "POST",
      body: postApiV4ProjectsIdEnvironmentsStopStale,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all integrated error tracking client keys for a specified project.
    *
    * @tags error_tracking
    * @name GetApiV4ProjectsIdErrorTrackingClientKeys
    * @summary List all project client keys
    * @request GET:/api/v4/projects/{id}/error_tracking/client_keys
    */
    getApiV4ProjectsIdErrorTrackingClientKeys: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/error_tracking/client_keys`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates a client key for integrated error tracking in a specified project. The public key attribute is generated automatically.
    *
    * @tags error_tracking
    * @name PostApiV4ProjectsIdErrorTrackingClientKeys
    * @summary Create a client key
    * @request POST:/api/v4/projects/{id}/error_tracking/client_keys
    */
    postApiV4ProjectsIdErrorTrackingClientKeys: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/error_tracking/client_keys`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes an integrated error tracking client key from a specified project.
    *
    * @tags error_tracking
    * @name DeleteApiV4ProjectsIdErrorTrackingClientKeysKeyId
    * @summary Delete a client key
    * @request DELETE:/api/v4/projects/{id}/error_tracking/client_keys/{key_id}
    */
    deleteApiV4ProjectsIdErrorTrackingClientKeysKeyId: (id, keyId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/error_tracking/client_keys/${keyId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Retrieves the Error Tracking settings for a specified project.
    *
    * @tags error_tracking
    * @name GetApiV4ProjectsIdErrorTrackingSettings
    * @summary Retrieve Error Tracking settings for a project
    * @request GET:/api/v4/projects/{id}/error_tracking/settings
    */
    getApiV4ProjectsIdErrorTrackingSettings: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/error_tracking/settings`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates Error Tracking settings for a specified project. You must have the Maintainer or Owner role for the project.
    *
    * @tags error_tracking
    * @name PatchApiV4ProjectsIdErrorTrackingSettings
    * @summary Update Error Tracking settings for a project
    * @request PATCH:/api/v4/projects/{id}/error_tracking/settings
    */
    patchApiV4ProjectsIdErrorTrackingSettings: (id, patchApiV4ProjectsIdErrorTrackingSettings, params = {}) => this.request({
      path: `/api/v4/projects/${id}/error_tracking/settings`,
      method: "PATCH",
      body: patchApiV4ProjectsIdErrorTrackingSettings,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates Error Tracking settings for a specified project. You must have the Maintainer or Owner role for the project.
    *
    * @tags error_tracking
    * @name PutApiV4ProjectsIdErrorTrackingSettings
    * @summary Create Error Tracking settings for a project
    * @request PUT:/api/v4/projects/{id}/error_tracking/settings
    */
    putApiV4ProjectsIdErrorTrackingSettings: (id, putApiV4ProjectsIdErrorTrackingSettings, params = {}) => this.request({
      path: `/api/v4/projects/${id}/error_tracking/settings`,
      method: "PUT",
      body: putApiV4ProjectsIdErrorTrackingSettings,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all feature flags of the requested project. Use the `page` and `per_page` pagination parameters to control the pagination of results.
    *
    * @tags feature_flags
    * @name GetApiV4ProjectsIdFeatureFlags
    * @summary List all feature flags for a project
    * @request GET:/api/v4/projects/{id}/feature_flags
    */
    getApiV4ProjectsIdFeatureFlags: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/feature_flags`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a feature flag for a specified project.
    *
    * @tags feature_flags
    * @name PostApiV4ProjectsIdFeatureFlags
    * @summary Create a feature flag
    * @request POST:/api/v4/projects/{id}/feature_flags
    */
    postApiV4ProjectsIdFeatureFlags: (id, postApiV4ProjectsIdFeatureFlags, params = {}) => this.request({
      path: `/api/v4/projects/${id}/feature_flags`,
      method: "POST",
      body: postApiV4ProjectsIdFeatureFlags,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified feature flag.
    *
    * @tags feature_flags
    * @name GetApiV4ProjectsIdFeatureFlagsFeatureFlagName
    * @summary Retrieve a feature flag
    * @request GET:/api/v4/projects/{id}/feature_flags/{feature_flag_name}
    */
    getApiV4ProjectsIdFeatureFlagsFeatureFlagName: (id, featureFlagName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/feature_flags/${featureFlagName}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified feature flag.
    *
    * @tags feature_flags
    * @name PutApiV4ProjectsIdFeatureFlagsFeatureFlagName
    * @summary Update a feature flag
    * @request PUT:/api/v4/projects/{id}/feature_flags/{feature_flag_name}
    */
    putApiV4ProjectsIdFeatureFlagsFeatureFlagName: (id, featureFlagName, putApiV4ProjectsIdFeatureFlagsFeatureFlagName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/feature_flags/${featureFlagName}`,
      method: "PUT",
      body: putApiV4ProjectsIdFeatureFlagsFeatureFlagName,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified feature flag.
    *
    * @tags feature_flags
    * @name DeleteApiV4ProjectsIdFeatureFlagsFeatureFlagName
    * @summary Delete a feature flag
    * @request DELETE:/api/v4/projects/{id}/feature_flags/{feature_flag_name}
    */
    deleteApiV4ProjectsIdFeatureFlagsFeatureFlagName: (id, featureFlagName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/feature_flags/${featureFlagName}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all feature flag user lists for a specified project.
    *
    * @tags feature_flags
    * @name GetApiV4ProjectsIdFeatureFlagsUserLists
    * @summary List all feature flag user lists for a project
    * @request GET:/api/v4/projects/{id}/feature_flags_user_lists
    */
    getApiV4ProjectsIdFeatureFlagsUserLists: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/feature_flags_user_lists`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a feature flag user list in a specified project.
    *
    * @tags feature_flags
    * @name PostApiV4ProjectsIdFeatureFlagsUserLists
    * @summary Create a feature flag user list
    * @request POST:/api/v4/projects/{id}/feature_flags_user_lists
    */
    postApiV4ProjectsIdFeatureFlagsUserLists: (id, postApiV4ProjectsIdFeatureFlagsUserLists, params = {}) => this.request({
      path: `/api/v4/projects/${id}/feature_flags_user_lists`,
      method: "POST",
      body: postApiV4ProjectsIdFeatureFlagsUserLists,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified feature flag user list.
    *
    * @tags feature_flags
    * @name GetApiV4ProjectsIdFeatureFlagsUserListsIid
    * @summary Retrieve a feature flag user list
    * @request GET:/api/v4/projects/{id}/feature_flags_user_lists/{iid}
    */
    getApiV4ProjectsIdFeatureFlagsUserListsIid: (id, iid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/feature_flags_user_lists/${iid}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified feature flag user list.
    *
    * @tags feature_flags
    * @name PutApiV4ProjectsIdFeatureFlagsUserListsIid
    * @summary Update a feature flag user list
    * @request PUT:/api/v4/projects/{id}/feature_flags_user_lists/{iid}
    */
    putApiV4ProjectsIdFeatureFlagsUserListsIid: (id, iid, putApiV4ProjectsIdFeatureFlagsUserListsIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/feature_flags_user_lists/${iid}`,
      method: "PUT",
      body: putApiV4ProjectsIdFeatureFlagsUserListsIid,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified feature flag user list.
    *
    * @tags feature_flags
    * @name DeleteApiV4ProjectsIdFeatureFlagsUserListsIid
    * @summary Delete feature flag user list
    * @request DELETE:/api/v4/projects/{id}/feature_flags_user_lists/{iid}
    */
    deleteApiV4ProjectsIdFeatureFlagsUserListsIid: (id, iid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/feature_flags_user_lists/${iid}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Retrieves blame metadata for lines in a specified file.
    *
    * @tags files
    * @name HeadApiV4ProjectsIdRepositoryFilesFilePathBlame
    * @summary Retrieve file blame metadata
    * @request HEAD:/api/v4/projects/{id}/repository/files/{file_path}/blame
    */
    headApiV4ProjectsIdRepositoryFilesFilePathBlame: (id, filePath, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/files/${filePath}/blame`,
      method: "HEAD",
      query,
      ...params
    }),
    /**
    * @description Retrieves blame history for a specified file in a repository. Each blame range contains lines and their corresponding commit information.
    *
    * @tags files
    * @name GetApiV4ProjectsIdRepositoryFilesFilePathBlame
    * @summary Retrieve file blame history from a repository
    * @request GET:/api/v4/projects/{id}/repository/files/{file_path}/blame
    */
    getApiV4ProjectsIdRepositoryFilesFilePathBlame: (id, filePath, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/files/${filePath}/blame`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the raw file contents for a specified file in a repository.
    *
    * @tags files
    * @name GetApiV4ProjectsIdRepositoryFilesFilePathRaw
    * @summary Retrieve a raw file from a repository
    * @request GET:/api/v4/projects/{id}/repository/files/{file_path}/raw
    */
    getApiV4ProjectsIdRepositoryFilesFilePathRaw: (id, filePath, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/files/${filePath}/raw`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves metadata for a specified file in a repository.
    *
    * @tags files
    * @name HeadApiV4ProjectsIdRepositoryFilesFilePath
    * @summary Retrieve file metadata
    * @request HEAD:/api/v4/projects/{id}/repository/files/{file_path}
    */
    headApiV4ProjectsIdRepositoryFilesFilePath: (id, filePath, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/files/${filePath}`,
      method: "HEAD",
      query,
      ...params
    }),
    /**
    * @description Retrieves information about a specified file in a repository. This includes information like the name, size, and the file contents. File content is Base64 encoded.
    *
    * @tags files
    * @name GetApiV4ProjectsIdRepositoryFilesFilePath
    * @summary Retrieve a file from a repository
    * @request GET:/api/v4/projects/{id}/repository/files/{file_path}
    */
    getApiV4ProjectsIdRepositoryFilesFilePath: (id, filePath, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/files/${filePath}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Creates a file in a specified repository. Use the Commits API to create multiple files with a single request.
    *
    * @tags files
    * @name PostApiV4ProjectsIdRepositoryFilesFilePath
    * @summary Create a file in a repository
    * @request POST:/api/v4/projects/{id}/repository/files/{file_path}
    */
    postApiV4ProjectsIdRepositoryFilesFilePath: (id, filePath, postApiV4ProjectsIdRepositoryFilesFilePath, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/files/${filePath}`,
      method: "POST",
      body: postApiV4ProjectsIdRepositoryFilesFilePath,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Updates a specified file in a repository. Use the Commits API to update multiple files with a single request.
    *
    * @tags files
    * @name PutApiV4ProjectsIdRepositoryFilesFilePath
    * @summary Update a file in a repository
    * @request PUT:/api/v4/projects/{id}/repository/files/{file_path}
    */
    putApiV4ProjectsIdRepositoryFilesFilePath: (id, filePath, putApiV4ProjectsIdRepositoryFilesFilePath, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/files/${filePath}`,
      method: "PUT",
      body: putApiV4ProjectsIdRepositoryFilesFilePath,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Deletes a specified file in a repository. Use the Commits API to delete multiple files with a single request.
    *
    * @tags files
    * @name DeleteApiV4ProjectsIdRepositoryFilesFilePath
    * @summary Delete a file in a repository
    * @request DELETE:/api/v4/projects/{id}/repository/files/{file_path}
    */
    deleteApiV4ProjectsIdRepositoryFilesFilePath: (id, filePath, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/files/${filePath}`,
      method: "DELETE",
      query,
      ...params
    }),
    /**
    * @description Lists all freeze periods for a specified project.
    *
    * @tags freeze_periods
    * @name GetApiV4ProjectsIdFreezePeriods
    * @summary List all freeze periods
    * @request GET:/api/v4/projects/{id}/freeze_periods
    */
    getApiV4ProjectsIdFreezePeriods: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/freeze_periods`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a freeze period for a specified project. You must have the Maintainer or Owner role for the project.
    *
    * @tags freeze_periods
    * @name PostApiV4ProjectsIdFreezePeriods
    * @summary Create a freeze period
    * @request POST:/api/v4/projects/{id}/freeze_periods
    */
    postApiV4ProjectsIdFreezePeriods: (id, postApiV4ProjectsIdFreezePeriods, params = {}) => this.request({
      path: `/api/v4/projects/${id}/freeze_periods`,
      method: "POST",
      body: postApiV4ProjectsIdFreezePeriods,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a freeze period for a specified `freeze_period_id`. You must have the Reporter, Developer, Maintainer, or Owner role for the project.
    *
    * @tags freeze_periods
    * @name GetApiV4ProjectsIdFreezePeriodsFreezePeriodId
    * @summary Retrieve a freeze period
    * @request GET:/api/v4/projects/{id}/freeze_periods/{freeze_period_id}
    */
    getApiV4ProjectsIdFreezePeriodsFreezePeriodId: (id, freezePeriodId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/freeze_periods/${freezePeriodId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a freeze period for a specified `freeze_period_id`. You must have the Maintainer or Owner role for the project.
    *
    * @tags freeze_periods
    * @name PutApiV4ProjectsIdFreezePeriodsFreezePeriodId
    * @summary Update a freeze period
    * @request PUT:/api/v4/projects/{id}/freeze_periods/{freeze_period_id}
    */
    putApiV4ProjectsIdFreezePeriodsFreezePeriodId: (id, freezePeriodId, putApiV4ProjectsIdFreezePeriodsFreezePeriodId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/freeze_periods/${freezePeriodId}`,
      method: "PUT",
      body: putApiV4ProjectsIdFreezePeriodsFreezePeriodId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a freeze period for a specified `freeze_period_id`. You must have the Maintainer or Owner role for the project.
    *
    * @tags freeze_periods
    * @name DeleteApiV4ProjectsIdFreezePeriodsFreezePeriodId
    * @summary Delete a freeze period
    * @request DELETE:/api/v4/projects/{id}/freeze_periods/{freeze_period_id}
    */
    deleteApiV4ProjectsIdFreezePeriodsFreezePeriodId: (id, freezePeriodId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/freeze_periods/${freezePeriodId}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.5
    *
    * @tags packages
    * @name PutApiV4ProjectsIdPackagesGenericPackageNamePackageVersionPathFileNameAuthorize
    * @summary Workhorse authorize generic package file
    * @request PUT:/api/v4/projects/{id}/packages/generic/{package_name}/*package_version/(*path/){file_name}/authorize
    */
    putApiV4ProjectsIdPackagesGenericPackageNamePackageVersionPathFileNameAuthorize: (id, packageName, fileName, putApiV4ProjectsIdPackagesGenericPackageNamepackageVersionPathFileNameAuthorize, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/generic/${packageName}/*package_version/(*path/)${fileName}/authorize`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesGenericPackageNamepackageVersionPathFileNameAuthorize,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.5
    *
    * @tags packages
    * @name PutApiV4ProjectsIdPackagesGenericPackageNamePackageVersionPathFileName
    * @summary Upload package file
    * @request PUT:/api/v4/projects/{id}/packages/generic/{package_name}/*package_version/(*path/){file_name}
    */
    putApiV4ProjectsIdPackagesGenericPackageNamePackageVersionPathFileName: (id, packageName, fileName, putApiV4ProjectsIdPackagesGenericPackageNamepackageVersionPathFileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/generic/${packageName}/*package_version/(*path/)${fileName}`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesGenericPackageNamepackageVersionPathFileName,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.5
    *
    * @tags packages
    * @name GetApiV4ProjectsIdPackagesGenericPackageNamePackageVersionPathFileName
    * @summary Download package file
    * @request GET:/api/v4/projects/{id}/packages/generic/{package_name}/*package_version/(*path/){file_name}
    */
    getApiV4ProjectsIdPackagesGenericPackageNamePackageVersionPathFileName: (id, packageName, fileName, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/generic/${packageName}/*package_version/(*path/)${fileName}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Get all tagged versions for a given Go module.See `go help goproxy`, GET $GOPROXY/<module>/@v/list. This feature was introduced in GitLab 13.1.
    *
    * @tags packages
    * @name GetApiV4ProjectsIdPackagesGoModuleNameVList
    * @summary List
    * @request GET:/api/v4/projects/{id}/packages/go/*module_name/@v/list
    */
    getApiV4ProjectsIdPackagesGoModuleNameVList: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/go/*module_name/@v/list`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Get all tagged versions for a given Go module.See `go help goproxy`, GET $GOPROXY/<module>/@v/<version>.info. This feature was introduced in GitLab 13.1
    *
    * @tags packages
    * @name GetApiV4ProjectsIdPackagesGoModuleNameVModuleVersionInfo
    * @summary Version metadata
    * @request GET:/api/v4/projects/{id}/packages/go/*module_name/@v/{module_version}.info
    */
    getApiV4ProjectsIdPackagesGoModuleNameVModuleVersionInfo: (id, moduleVersion, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/go/*module_name/@v/${moduleVersion}.info`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Get the module file of a given module version.See `go help goproxy`, GET $GOPROXY/<module>/@v/<version>.mod. This feature was introduced in GitLab 13.1.
    *
    * @tags packages
    * @name GetApiV4ProjectsIdPackagesGoModuleNameVModuleVersionMod
    * @summary Download module file
    * @request GET:/api/v4/projects/{id}/packages/go/*module_name/@v/{module_version}.mod
    */
    getApiV4ProjectsIdPackagesGoModuleNameVModuleVersionMod: (id, moduleVersion, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/go/*module_name/@v/${moduleVersion}.mod`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Get a zip of the source of the given module version.See `go help goproxy`, GET $GOPROXY/<module>/@v/<version>.zip. This feature was introduced in GitLab 13.1.
    *
    * @tags packages
    * @name GetApiV4ProjectsIdPackagesGoModuleNameVModuleVersionZip
    * @summary Download module source
    * @request GET:/api/v4/projects/{id}/packages/go/*module_name/@v/{module_version}.zip
    */
    getApiV4ProjectsIdPackagesGoModuleNameVModuleVersionZip: (id, moduleVersion, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/go/*module_name/@v/${moduleVersion}.zip`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Downloads a specified chart index for a project.
    *
    * @tags packages_helm
    * @name GetApiV4ProjectsIdPackagesHelmChannelIndexYaml
    * @summary Download a chart index
    * @request GET:/api/v4/projects/{id}/packages/helm/{channel}/index.yaml
    */
    getApiV4ProjectsIdPackagesHelmChannelIndexYaml: (id, channel, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/helm/${channel}/index.yaml`,
      method: "GET",
      ...params
    }),
    /**
    * @description Downloads a specified chart for a project.
    *
    * @tags packages_helm
    * @name GetApiV4ProjectsIdPackagesHelmChannelChartsFileNameTgz
    * @summary Download a chart
    * @request GET:/api/v4/projects/{id}/packages/helm/{channel}/charts/{file_name}.tgz
    */
    getApiV4ProjectsIdPackagesHelmChannelChartsFileNameTgz: (id, channel, fileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/helm/${channel}/charts/${fileName}.tgz`,
      method: "GET",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 14.0
    *
    * @tags packages_helm
    * @name PostApiV4ProjectsIdPackagesHelmApiChannelChartsAuthorize
    * @summary Authorize a chart upload from workhorse
    * @request POST:/api/v4/projects/{id}/packages/helm/api/{channel}/charts/authorize
    */
    postApiV4ProjectsIdPackagesHelmApiChannelChartsAuthorize: (id, channel, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/helm/api/${channel}/charts/authorize`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Uploads a specified chart for a project.
    *
    * @tags packages_helm
    * @name PostApiV4ProjectsIdPackagesHelmApiChannelCharts
    * @summary Upload a chart
    * @request POST:/api/v4/projects/{id}/packages/helm/api/{channel}/charts
    */
    postApiV4ProjectsIdPackagesHelmApiChannelCharts: (id, channel, postApiV4ProjectsIdPackagesHelmApiChannelCharts, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/helm/api/${channel}/charts`,
      method: "POST",
      body: postApiV4ProjectsIdPackagesHelmApiChannelCharts,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all active integrations.
    *
    * @tags integrations
    * @name GetApiV4ProjectsIdServices
    * @summary List all active integrations
    * @request GET:/api/v4/projects/{id}/services
    */
    getApiV4ProjectsIdServices: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Apple App Store integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesAppleAppStore
    * @summary Create or update the Apple App Store integration
    * @request PUT:/api/v4/projects/{id}/services/apple-app-store
    */
    putApiV4ProjectsIdServicesAppleAppStore: (id, putApiV4ProjectsIdServicesAppleAppStore, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/apple-app-store`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesAppleAppStore,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Asana integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesAsana
    * @summary Create or update the Asana integration
    * @request PUT:/api/v4/projects/{id}/services/asana
    */
    putApiV4ProjectsIdServicesAsana: (id, putApiV4ProjectsIdServicesAsana, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/asana`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesAsana,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Assembla integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesAssembla
    * @summary Create or update the Assembla integration
    * @request PUT:/api/v4/projects/{id}/services/assembla
    */
    putApiV4ProjectsIdServicesAssembla: (id, putApiV4ProjectsIdServicesAssembla, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/assembla`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesAssembla,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Bamboo integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesBamboo
    * @summary Create or update the Bamboo integration
    * @request PUT:/api/v4/projects/{id}/services/bamboo
    */
    putApiV4ProjectsIdServicesBamboo: (id, putApiV4ProjectsIdServicesBamboo, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/bamboo`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesBamboo,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Bugzilla integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesBugzilla
    * @summary Create or update the Bugzilla integration
    * @request PUT:/api/v4/projects/{id}/services/bugzilla
    */
    putApiV4ProjectsIdServicesBugzilla: (id, putApiV4ProjectsIdServicesBugzilla, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/bugzilla`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesBugzilla,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Buildkite integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesBuildkite
    * @summary Create or update the Buildkite integration
    * @request PUT:/api/v4/projects/{id}/services/buildkite
    */
    putApiV4ProjectsIdServicesBuildkite: (id, putApiV4ProjectsIdServicesBuildkite, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/buildkite`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesBuildkite,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Campfire integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesCampfire
    * @summary Create or update the Campfire integration
    * @request PUT:/api/v4/projects/{id}/services/campfire
    */
    putApiV4ProjectsIdServicesCampfire: (id, putApiV4ProjectsIdServicesCampfire, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/campfire`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesCampfire,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Confluence integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesConfluence
    * @summary Create or update the Confluence integration
    * @request PUT:/api/v4/projects/{id}/services/confluence
    */
    putApiV4ProjectsIdServicesConfluence: (id, putApiV4ProjectsIdServicesConfluence, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/confluence`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesConfluence,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Custom Issue Tracker integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesCustomIssueTracker
    * @summary Create or update the Custom Issue Tracker integration
    * @request PUT:/api/v4/projects/{id}/services/custom-issue-tracker
    */
    putApiV4ProjectsIdServicesCustomIssueTracker: (id, putApiV4ProjectsIdServicesCustomIssueTracker, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/custom-issue-tracker`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesCustomIssueTracker,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Datadog integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesDatadog
    * @summary Create or update the Datadog integration
    * @request PUT:/api/v4/projects/{id}/services/datadog
    */
    putApiV4ProjectsIdServicesDatadog: (id, putApiV4ProjectsIdServicesDatadog, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/datadog`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesDatadog,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Diffblue Cover integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesDiffblueCover
    * @summary Create or update the Diffblue Cover integration
    * @request PUT:/api/v4/projects/{id}/services/diffblue-cover
    */
    putApiV4ProjectsIdServicesDiffblueCover: (id, putApiV4ProjectsIdServicesDiffblueCover, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/diffblue-cover`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesDiffblueCover,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Discord integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesDiscord
    * @summary Create or update the Discord integration
    * @request PUT:/api/v4/projects/{id}/services/discord
    */
    putApiV4ProjectsIdServicesDiscord: (id, putApiV4ProjectsIdServicesDiscord, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/discord`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesDiscord,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Drone Ci integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesDroneCi
    * @summary Create or update the Drone Ci integration
    * @request PUT:/api/v4/projects/{id}/services/drone-ci
    */
    putApiV4ProjectsIdServicesDroneCi: (id, putApiV4ProjectsIdServicesDroneCi, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/drone-ci`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesDroneCi,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Emails On Push integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesEmailsOnPush
    * @summary Create or update the Emails On Push integration
    * @request PUT:/api/v4/projects/{id}/services/emails-on-push
    */
    putApiV4ProjectsIdServicesEmailsOnPush: (id, putApiV4ProjectsIdServicesEmailsOnPush, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/emails-on-push`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesEmailsOnPush,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the External Wiki integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesExternalWiki
    * @summary Create or update the External Wiki integration
    * @request PUT:/api/v4/projects/{id}/services/external-wiki
    */
    putApiV4ProjectsIdServicesExternalWiki: (id, putApiV4ProjectsIdServicesExternalWiki, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/external-wiki`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesExternalWiki,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Gitlab Slack Application integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesGitlabSlackApplication
    * @summary Create or update the Gitlab Slack Application integration
    * @request PUT:/api/v4/projects/{id}/services/gitlab-slack-application
    */
    putApiV4ProjectsIdServicesGitlabSlackApplication: (id, putApiV4ProjectsIdServicesGitlabSlackApplication, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/gitlab-slack-application`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesGitlabSlackApplication,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Google Play integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesGooglePlay
    * @summary Create or update the Google Play integration
    * @request PUT:/api/v4/projects/{id}/services/google-play
    */
    putApiV4ProjectsIdServicesGooglePlay: (id, putApiV4ProjectsIdServicesGooglePlay, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/google-play`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesGooglePlay,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Hangouts Chat integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesHangoutsChat
    * @summary Create or update the Hangouts Chat integration
    * @request PUT:/api/v4/projects/{id}/services/hangouts-chat
    */
    putApiV4ProjectsIdServicesHangoutsChat: (id, putApiV4ProjectsIdServicesHangoutsChat, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/hangouts-chat`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesHangoutsChat,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Harbor integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesHarbor
    * @summary Create or update the Harbor integration
    * @request PUT:/api/v4/projects/{id}/services/harbor
    */
    putApiV4ProjectsIdServicesHarbor: (id, putApiV4ProjectsIdServicesHarbor, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/harbor`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesHarbor,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Irker integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesIrker
    * @summary Create or update the Irker integration
    * @request PUT:/api/v4/projects/{id}/services/irker
    */
    putApiV4ProjectsIdServicesIrker: (id, putApiV4ProjectsIdServicesIrker, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/irker`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesIrker,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Jenkins integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesJenkins
    * @summary Create or update the Jenkins integration
    * @request PUT:/api/v4/projects/{id}/services/jenkins
    */
    putApiV4ProjectsIdServicesJenkins: (id, putApiV4ProjectsIdServicesJenkins, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/jenkins`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesJenkins,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Jira integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesJira
    * @summary Create or update the Jira integration
    * @request PUT:/api/v4/projects/{id}/services/jira
    */
    putApiV4ProjectsIdServicesJira: (id, putApiV4ProjectsIdServicesJira, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/jira`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesJira,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Jira Cloud App integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesJiraCloudApp
    * @summary Create or update the Jira Cloud App integration
    * @request PUT:/api/v4/projects/{id}/services/jira-cloud-app
    */
    putApiV4ProjectsIdServicesJiraCloudApp: (id, putApiV4ProjectsIdServicesJiraCloudApp, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/jira-cloud-app`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesJiraCloudApp,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Linear integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesLinear
    * @summary Create or update the Linear integration
    * @request PUT:/api/v4/projects/{id}/services/linear
    */
    putApiV4ProjectsIdServicesLinear: (id, putApiV4ProjectsIdServicesLinear, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/linear`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesLinear,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Matrix integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesMatrix
    * @summary Create or update the Matrix integration
    * @request PUT:/api/v4/projects/{id}/services/matrix
    */
    putApiV4ProjectsIdServicesMatrix: (id, putApiV4ProjectsIdServicesMatrix, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/matrix`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesMatrix,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Mattermost Slash Commands integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesMattermostSlashCommands
    * @summary Create or update the Mattermost Slash Commands integration
    * @request PUT:/api/v4/projects/{id}/services/mattermost-slash-commands
    */
    putApiV4ProjectsIdServicesMattermostSlashCommands: (id, putApiV4ProjectsIdServicesMattermostSlashCommands, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/mattermost-slash-commands`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesMattermostSlashCommands,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Packagist integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesPackagist
    * @summary Create or update the Packagist integration
    * @request PUT:/api/v4/projects/{id}/services/packagist
    */
    putApiV4ProjectsIdServicesPackagist: (id, putApiV4ProjectsIdServicesPackagist, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/packagist`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesPackagist,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Phorge integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesPhorge
    * @summary Create or update the Phorge integration
    * @request PUT:/api/v4/projects/{id}/services/phorge
    */
    putApiV4ProjectsIdServicesPhorge: (id, putApiV4ProjectsIdServicesPhorge, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/phorge`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesPhorge,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Pipelines Email integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesPipelinesEmail
    * @summary Create or update the Pipelines Email integration
    * @request PUT:/api/v4/projects/{id}/services/pipelines-email
    */
    putApiV4ProjectsIdServicesPipelinesEmail: (id, putApiV4ProjectsIdServicesPipelinesEmail, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/pipelines-email`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesPipelinesEmail,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Pivotaltracker integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesPivotaltracker
    * @summary Create or update the Pivotaltracker integration
    * @request PUT:/api/v4/projects/{id}/services/pivotaltracker
    */
    putApiV4ProjectsIdServicesPivotaltracker: (id, putApiV4ProjectsIdServicesPivotaltracker, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/pivotaltracker`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesPivotaltracker,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Pumble integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesPumble
    * @summary Create or update the Pumble integration
    * @request PUT:/api/v4/projects/{id}/services/pumble
    */
    putApiV4ProjectsIdServicesPumble: (id, putApiV4ProjectsIdServicesPumble, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/pumble`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesPumble,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Pushover integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesPushover
    * @summary Create or update the Pushover integration
    * @request PUT:/api/v4/projects/{id}/services/pushover
    */
    putApiV4ProjectsIdServicesPushover: (id, putApiV4ProjectsIdServicesPushover, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/pushover`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesPushover,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Redmine integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesRedmine
    * @summary Create or update the Redmine integration
    * @request PUT:/api/v4/projects/{id}/services/redmine
    */
    putApiV4ProjectsIdServicesRedmine: (id, putApiV4ProjectsIdServicesRedmine, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/redmine`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesRedmine,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Ewm integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesEwm
    * @summary Create or update the Ewm integration
    * @request PUT:/api/v4/projects/{id}/services/ewm
    */
    putApiV4ProjectsIdServicesEwm: (id, putApiV4ProjectsIdServicesEwm, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/ewm`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesEwm,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Youtrack integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesYoutrack
    * @summary Create or update the Youtrack integration
    * @request PUT:/api/v4/projects/{id}/services/youtrack
    */
    putApiV4ProjectsIdServicesYoutrack: (id, putApiV4ProjectsIdServicesYoutrack, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/youtrack`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesYoutrack,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Clickup integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesClickup
    * @summary Create or update the Clickup integration
    * @request PUT:/api/v4/projects/{id}/services/clickup
    */
    putApiV4ProjectsIdServicesClickup: (id, putApiV4ProjectsIdServicesClickup, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/clickup`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesClickup,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Slack integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesSlack
    * @summary Create or update the Slack integration
    * @request PUT:/api/v4/projects/{id}/services/slack
    */
    putApiV4ProjectsIdServicesSlack: (id, putApiV4ProjectsIdServicesSlack, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/slack`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesSlack,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Microsoft Teams integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesMicrosoftTeams
    * @summary Create or update the Microsoft Teams integration
    * @request PUT:/api/v4/projects/{id}/services/microsoft-teams
    */
    putApiV4ProjectsIdServicesMicrosoftTeams: (id, putApiV4ProjectsIdServicesMicrosoftTeams, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/microsoft-teams`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesMicrosoftTeams,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Mattermost integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesMattermost
    * @summary Create or update the Mattermost integration
    * @request PUT:/api/v4/projects/{id}/services/mattermost
    */
    putApiV4ProjectsIdServicesMattermost: (id, putApiV4ProjectsIdServicesMattermost, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/mattermost`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesMattermost,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Teamcity integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesTeamcity
    * @summary Create or update the Teamcity integration
    * @request PUT:/api/v4/projects/{id}/services/teamcity
    */
    putApiV4ProjectsIdServicesTeamcity: (id, putApiV4ProjectsIdServicesTeamcity, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/teamcity`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesTeamcity,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Telegram integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesTelegram
    * @summary Create or update the Telegram integration
    * @request PUT:/api/v4/projects/{id}/services/telegram
    */
    putApiV4ProjectsIdServicesTelegram: (id, putApiV4ProjectsIdServicesTelegram, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/telegram`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesTelegram,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Unify Circuit integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesUnifyCircuit
    * @summary Create or update the Unify Circuit integration
    * @request PUT:/api/v4/projects/{id}/services/unify-circuit
    */
    putApiV4ProjectsIdServicesUnifyCircuit: (id, putApiV4ProjectsIdServicesUnifyCircuit, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/unify-circuit`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesUnifyCircuit,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Webex Teams integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesWebexTeams
    * @summary Create or update the Webex Teams integration
    * @request PUT:/api/v4/projects/{id}/services/webex-teams
    */
    putApiV4ProjectsIdServicesWebexTeams: (id, putApiV4ProjectsIdServicesWebexTeams, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/webex-teams`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesWebexTeams,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Zentao integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesZentao
    * @summary Create or update the Zentao integration
    * @request PUT:/api/v4/projects/{id}/services/zentao
    */
    putApiV4ProjectsIdServicesZentao: (id, putApiV4ProjectsIdServicesZentao, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/zentao`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesZentao,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Squash Tm integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesSquashTm
    * @summary Create or update the Squash Tm integration
    * @request PUT:/api/v4/projects/{id}/services/squash-tm
    */
    putApiV4ProjectsIdServicesSquashTm: (id, putApiV4ProjectsIdServicesSquashTm, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/squash-tm`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesSquashTm,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Github integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesGithub
    * @summary Create or update the Github integration
    * @request PUT:/api/v4/projects/{id}/services/github
    */
    putApiV4ProjectsIdServicesGithub: (id, putApiV4ProjectsIdServicesGithub, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/github`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesGithub,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Git Guardian integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesGitGuardian
    * @summary Create or update the Git Guardian integration
    * @request PUT:/api/v4/projects/{id}/services/git-guardian
    */
    putApiV4ProjectsIdServicesGitGuardian: (id, putApiV4ProjectsIdServicesGitGuardian, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/git-guardian`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesGitGuardian,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Google Cloud Platform Artifact Registry integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesGoogleCloudPlatformArtifactRegistry
    * @summary Create or update the Google Cloud Platform Artifact Registry integration
    * @request PUT:/api/v4/projects/{id}/services/google-cloud-platform-artifact-registry
    */
    putApiV4ProjectsIdServicesGoogleCloudPlatformArtifactRegistry: (id, putApiV4ProjectsIdServicesGoogleCloudPlatformArtifactRegistry, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/google-cloud-platform-artifact-registry`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesGoogleCloudPlatformArtifactRegistry,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Google Cloud Platform Workload Identity Federation integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesGoogleCloudPlatformWorkloadIdentityFederation
    * @summary Create or update the Google Cloud Platform Workload Identity Federation integration
    * @request PUT:/api/v4/projects/{id}/services/google-cloud-platform-workload-identity-federation
    */
    putApiV4ProjectsIdServicesGoogleCloudPlatformWorkloadIdentityFederation: (id, putApiV4ProjectsIdServicesGoogleCloudPlatformWorkloadIdentityFederation, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/google-cloud-platform-workload-identity-federation`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesGoogleCloudPlatformWorkloadIdentityFederation,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Mock Ci integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesMockCi
    * @summary Create or update the Mock Ci integration
    * @request PUT:/api/v4/projects/{id}/services/mock-ci
    */
    putApiV4ProjectsIdServicesMockCi: (id, putApiV4ProjectsIdServicesMockCi, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/mock-ci`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesMockCi,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Mock Monitoring integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdServicesMockMonitoring
    * @summary Create or update the Mock Monitoring integration
    * @request PUT:/api/v4/projects/{id}/services/mock-monitoring
    */
    putApiV4ProjectsIdServicesMockMonitoring: (id, putApiV4ProjectsIdServicesMockMonitoring, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/mock-monitoring`,
      method: "PUT",
      body: putApiV4ProjectsIdServicesMockMonitoring,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Disables a specified integration. Integration settings are preserved.
    *
    * @tags integrations
    * @name DeleteApiV4ProjectsIdServicesSlug
    * @summary Disable an integration
    * @request DELETE:/api/v4/projects/{id}/services/{slug}
    */
    deleteApiV4ProjectsIdServicesSlug: (slug, id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/${slug}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Retrieves the settings for a specified integration.
    *
    * @tags integrations
    * @name GetApiV4ProjectsIdServicesSlug
    * @summary Retrieve integration settings
    * @request GET:/api/v4/projects/{id}/services/{slug}
    */
    getApiV4ProjectsIdServicesSlug: (slug, id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/${slug}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Triggers a slash command for mattermost-slash-commands.
    *
    * @tags integrations
    * @name PostApiV4ProjectsIdServicesMattermostSlashCommandsTrigger
    * @summary Trigger a slash command for mattermost-slash-commands
    * @request POST:/api/v4/projects/{id}/services/mattermost_slash_commands/trigger
    */
    postApiV4ProjectsIdServicesMattermostSlashCommandsTrigger: (id, postApiV4ProjectsIdServicesMattermostSlashCommandsTrigger, params = {}) => this.request({
      path: `/api/v4/projects/${id}/services/mattermost_slash_commands/trigger`,
      method: "POST",
      body: postApiV4ProjectsIdServicesMattermostSlashCommandsTrigger,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all active integrations.
    *
    * @tags integrations
    * @name GetApiV4ProjectsIdIntegrations
    * @summary List all active integrations
    * @request GET:/api/v4/projects/{id}/integrations
    */
    getApiV4ProjectsIdIntegrations: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Apple App Store integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsAppleAppStore
    * @summary Create or update the Apple App Store integration
    * @request PUT:/api/v4/projects/{id}/integrations/apple-app-store
    */
    putApiV4ProjectsIdIntegrationsAppleAppStore: (id, putApiV4ProjectsIdIntegrationsAppleAppStore, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/apple-app-store`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsAppleAppStore,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Asana integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsAsana
    * @summary Create or update the Asana integration
    * @request PUT:/api/v4/projects/{id}/integrations/asana
    */
    putApiV4ProjectsIdIntegrationsAsana: (id, putApiV4ProjectsIdIntegrationsAsana, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/asana`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsAsana,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Assembla integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsAssembla
    * @summary Create or update the Assembla integration
    * @request PUT:/api/v4/projects/{id}/integrations/assembla
    */
    putApiV4ProjectsIdIntegrationsAssembla: (id, putApiV4ProjectsIdIntegrationsAssembla, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/assembla`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsAssembla,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Bamboo integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsBamboo
    * @summary Create or update the Bamboo integration
    * @request PUT:/api/v4/projects/{id}/integrations/bamboo
    */
    putApiV4ProjectsIdIntegrationsBamboo: (id, putApiV4ProjectsIdIntegrationsBamboo, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/bamboo`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsBamboo,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Bugzilla integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsBugzilla
    * @summary Create or update the Bugzilla integration
    * @request PUT:/api/v4/projects/{id}/integrations/bugzilla
    */
    putApiV4ProjectsIdIntegrationsBugzilla: (id, putApiV4ProjectsIdIntegrationsBugzilla, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/bugzilla`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsBugzilla,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Buildkite integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsBuildkite
    * @summary Create or update the Buildkite integration
    * @request PUT:/api/v4/projects/{id}/integrations/buildkite
    */
    putApiV4ProjectsIdIntegrationsBuildkite: (id, putApiV4ProjectsIdIntegrationsBuildkite, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/buildkite`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsBuildkite,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Campfire integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsCampfire
    * @summary Create or update the Campfire integration
    * @request PUT:/api/v4/projects/{id}/integrations/campfire
    */
    putApiV4ProjectsIdIntegrationsCampfire: (id, putApiV4ProjectsIdIntegrationsCampfire, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/campfire`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsCampfire,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Confluence integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsConfluence
    * @summary Create or update the Confluence integration
    * @request PUT:/api/v4/projects/{id}/integrations/confluence
    */
    putApiV4ProjectsIdIntegrationsConfluence: (id, putApiV4ProjectsIdIntegrationsConfluence, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/confluence`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsConfluence,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Custom Issue Tracker integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsCustomIssueTracker
    * @summary Create or update the Custom Issue Tracker integration
    * @request PUT:/api/v4/projects/{id}/integrations/custom-issue-tracker
    */
    putApiV4ProjectsIdIntegrationsCustomIssueTracker: (id, putApiV4ProjectsIdIntegrationsCustomIssueTracker, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/custom-issue-tracker`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsCustomIssueTracker,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Datadog integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsDatadog
    * @summary Create or update the Datadog integration
    * @request PUT:/api/v4/projects/{id}/integrations/datadog
    */
    putApiV4ProjectsIdIntegrationsDatadog: (id, putApiV4ProjectsIdIntegrationsDatadog, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/datadog`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsDatadog,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Diffblue Cover integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsDiffblueCover
    * @summary Create or update the Diffblue Cover integration
    * @request PUT:/api/v4/projects/{id}/integrations/diffblue-cover
    */
    putApiV4ProjectsIdIntegrationsDiffblueCover: (id, putApiV4ProjectsIdIntegrationsDiffblueCover, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/diffblue-cover`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsDiffblueCover,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Discord integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsDiscord
    * @summary Create or update the Discord integration
    * @request PUT:/api/v4/projects/{id}/integrations/discord
    */
    putApiV4ProjectsIdIntegrationsDiscord: (id, putApiV4ProjectsIdIntegrationsDiscord, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/discord`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsDiscord,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Drone Ci integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsDroneCi
    * @summary Create or update the Drone Ci integration
    * @request PUT:/api/v4/projects/{id}/integrations/drone-ci
    */
    putApiV4ProjectsIdIntegrationsDroneCi: (id, putApiV4ProjectsIdIntegrationsDroneCi, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/drone-ci`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsDroneCi,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Emails On Push integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsEmailsOnPush
    * @summary Create or update the Emails On Push integration
    * @request PUT:/api/v4/projects/{id}/integrations/emails-on-push
    */
    putApiV4ProjectsIdIntegrationsEmailsOnPush: (id, putApiV4ProjectsIdIntegrationsEmailsOnPush, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/emails-on-push`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsEmailsOnPush,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the External Wiki integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsExternalWiki
    * @summary Create or update the External Wiki integration
    * @request PUT:/api/v4/projects/{id}/integrations/external-wiki
    */
    putApiV4ProjectsIdIntegrationsExternalWiki: (id, putApiV4ProjectsIdIntegrationsExternalWiki, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/external-wiki`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsExternalWiki,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Gitlab Slack Application integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsGitlabSlackApplication
    * @summary Create or update the Gitlab Slack Application integration
    * @request PUT:/api/v4/projects/{id}/integrations/gitlab-slack-application
    */
    putApiV4ProjectsIdIntegrationsGitlabSlackApplication: (id, putApiV4ProjectsIdIntegrationsGitlabSlackApplication, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/gitlab-slack-application`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsGitlabSlackApplication,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Google Play integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsGooglePlay
    * @summary Create or update the Google Play integration
    * @request PUT:/api/v4/projects/{id}/integrations/google-play
    */
    putApiV4ProjectsIdIntegrationsGooglePlay: (id, putApiV4ProjectsIdIntegrationsGooglePlay, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/google-play`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsGooglePlay,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Hangouts Chat integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsHangoutsChat
    * @summary Create or update the Hangouts Chat integration
    * @request PUT:/api/v4/projects/{id}/integrations/hangouts-chat
    */
    putApiV4ProjectsIdIntegrationsHangoutsChat: (id, putApiV4ProjectsIdIntegrationsHangoutsChat, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/hangouts-chat`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsHangoutsChat,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Harbor integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsHarbor
    * @summary Create or update the Harbor integration
    * @request PUT:/api/v4/projects/{id}/integrations/harbor
    */
    putApiV4ProjectsIdIntegrationsHarbor: (id, putApiV4ProjectsIdIntegrationsHarbor, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/harbor`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsHarbor,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Irker integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsIrker
    * @summary Create or update the Irker integration
    * @request PUT:/api/v4/projects/{id}/integrations/irker
    */
    putApiV4ProjectsIdIntegrationsIrker: (id, putApiV4ProjectsIdIntegrationsIrker, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/irker`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsIrker,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Jenkins integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsJenkins
    * @summary Create or update the Jenkins integration
    * @request PUT:/api/v4/projects/{id}/integrations/jenkins
    */
    putApiV4ProjectsIdIntegrationsJenkins: (id, putApiV4ProjectsIdIntegrationsJenkins, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/jenkins`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsJenkins,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Jira integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsJira
    * @summary Create or update the Jira integration
    * @request PUT:/api/v4/projects/{id}/integrations/jira
    */
    putApiV4ProjectsIdIntegrationsJira: (id, putApiV4ProjectsIdIntegrationsJira, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/jira`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsJira,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Jira Cloud App integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsJiraCloudApp
    * @summary Create or update the Jira Cloud App integration
    * @request PUT:/api/v4/projects/{id}/integrations/jira-cloud-app
    */
    putApiV4ProjectsIdIntegrationsJiraCloudApp: (id, putApiV4ProjectsIdIntegrationsJiraCloudApp, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/jira-cloud-app`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsJiraCloudApp,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Linear integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsLinear
    * @summary Create or update the Linear integration
    * @request PUT:/api/v4/projects/{id}/integrations/linear
    */
    putApiV4ProjectsIdIntegrationsLinear: (id, putApiV4ProjectsIdIntegrationsLinear, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/linear`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsLinear,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Matrix integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsMatrix
    * @summary Create or update the Matrix integration
    * @request PUT:/api/v4/projects/{id}/integrations/matrix
    */
    putApiV4ProjectsIdIntegrationsMatrix: (id, putApiV4ProjectsIdIntegrationsMatrix, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/matrix`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsMatrix,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Mattermost Slash Commands integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsMattermostSlashCommands
    * @summary Create or update the Mattermost Slash Commands integration
    * @request PUT:/api/v4/projects/{id}/integrations/mattermost-slash-commands
    */
    putApiV4ProjectsIdIntegrationsMattermostSlashCommands: (id, putApiV4ProjectsIdIntegrationsMattermostSlashCommands, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/mattermost-slash-commands`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsMattermostSlashCommands,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Packagist integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsPackagist
    * @summary Create or update the Packagist integration
    * @request PUT:/api/v4/projects/{id}/integrations/packagist
    */
    putApiV4ProjectsIdIntegrationsPackagist: (id, putApiV4ProjectsIdIntegrationsPackagist, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/packagist`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsPackagist,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Phorge integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsPhorge
    * @summary Create or update the Phorge integration
    * @request PUT:/api/v4/projects/{id}/integrations/phorge
    */
    putApiV4ProjectsIdIntegrationsPhorge: (id, putApiV4ProjectsIdIntegrationsPhorge, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/phorge`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsPhorge,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Pipelines Email integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsPipelinesEmail
    * @summary Create or update the Pipelines Email integration
    * @request PUT:/api/v4/projects/{id}/integrations/pipelines-email
    */
    putApiV4ProjectsIdIntegrationsPipelinesEmail: (id, putApiV4ProjectsIdIntegrationsPipelinesEmail, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/pipelines-email`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsPipelinesEmail,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Pivotaltracker integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsPivotaltracker
    * @summary Create or update the Pivotaltracker integration
    * @request PUT:/api/v4/projects/{id}/integrations/pivotaltracker
    */
    putApiV4ProjectsIdIntegrationsPivotaltracker: (id, putApiV4ProjectsIdIntegrationsPivotaltracker, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/pivotaltracker`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsPivotaltracker,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Pumble integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsPumble
    * @summary Create or update the Pumble integration
    * @request PUT:/api/v4/projects/{id}/integrations/pumble
    */
    putApiV4ProjectsIdIntegrationsPumble: (id, putApiV4ProjectsIdIntegrationsPumble, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/pumble`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsPumble,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Pushover integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsPushover
    * @summary Create or update the Pushover integration
    * @request PUT:/api/v4/projects/{id}/integrations/pushover
    */
    putApiV4ProjectsIdIntegrationsPushover: (id, putApiV4ProjectsIdIntegrationsPushover, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/pushover`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsPushover,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Redmine integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsRedmine
    * @summary Create or update the Redmine integration
    * @request PUT:/api/v4/projects/{id}/integrations/redmine
    */
    putApiV4ProjectsIdIntegrationsRedmine: (id, putApiV4ProjectsIdIntegrationsRedmine, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/redmine`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsRedmine,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Ewm integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsEwm
    * @summary Create or update the Ewm integration
    * @request PUT:/api/v4/projects/{id}/integrations/ewm
    */
    putApiV4ProjectsIdIntegrationsEwm: (id, putApiV4ProjectsIdIntegrationsEwm, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/ewm`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsEwm,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Youtrack integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsYoutrack
    * @summary Create or update the Youtrack integration
    * @request PUT:/api/v4/projects/{id}/integrations/youtrack
    */
    putApiV4ProjectsIdIntegrationsYoutrack: (id, putApiV4ProjectsIdIntegrationsYoutrack, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/youtrack`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsYoutrack,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Clickup integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsClickup
    * @summary Create or update the Clickup integration
    * @request PUT:/api/v4/projects/{id}/integrations/clickup
    */
    putApiV4ProjectsIdIntegrationsClickup: (id, putApiV4ProjectsIdIntegrationsClickup, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/clickup`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsClickup,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Slack integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsSlack
    * @summary Create or update the Slack integration
    * @request PUT:/api/v4/projects/{id}/integrations/slack
    */
    putApiV4ProjectsIdIntegrationsSlack: (id, putApiV4ProjectsIdIntegrationsSlack, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/slack`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsSlack,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Microsoft Teams integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsMicrosoftTeams
    * @summary Create or update the Microsoft Teams integration
    * @request PUT:/api/v4/projects/{id}/integrations/microsoft-teams
    */
    putApiV4ProjectsIdIntegrationsMicrosoftTeams: (id, putApiV4ProjectsIdIntegrationsMicrosoftTeams, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/microsoft-teams`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsMicrosoftTeams,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Mattermost integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsMattermost
    * @summary Create or update the Mattermost integration
    * @request PUT:/api/v4/projects/{id}/integrations/mattermost
    */
    putApiV4ProjectsIdIntegrationsMattermost: (id, putApiV4ProjectsIdIntegrationsMattermost, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/mattermost`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsMattermost,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Teamcity integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsTeamcity
    * @summary Create or update the Teamcity integration
    * @request PUT:/api/v4/projects/{id}/integrations/teamcity
    */
    putApiV4ProjectsIdIntegrationsTeamcity: (id, putApiV4ProjectsIdIntegrationsTeamcity, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/teamcity`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsTeamcity,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Telegram integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsTelegram
    * @summary Create or update the Telegram integration
    * @request PUT:/api/v4/projects/{id}/integrations/telegram
    */
    putApiV4ProjectsIdIntegrationsTelegram: (id, putApiV4ProjectsIdIntegrationsTelegram, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/telegram`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsTelegram,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Unify Circuit integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsUnifyCircuit
    * @summary Create or update the Unify Circuit integration
    * @request PUT:/api/v4/projects/{id}/integrations/unify-circuit
    */
    putApiV4ProjectsIdIntegrationsUnifyCircuit: (id, putApiV4ProjectsIdIntegrationsUnifyCircuit, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/unify-circuit`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsUnifyCircuit,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Webex Teams integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsWebexTeams
    * @summary Create or update the Webex Teams integration
    * @request PUT:/api/v4/projects/{id}/integrations/webex-teams
    */
    putApiV4ProjectsIdIntegrationsWebexTeams: (id, putApiV4ProjectsIdIntegrationsWebexTeams, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/webex-teams`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsWebexTeams,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Zentao integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsZentao
    * @summary Create or update the Zentao integration
    * @request PUT:/api/v4/projects/{id}/integrations/zentao
    */
    putApiV4ProjectsIdIntegrationsZentao: (id, putApiV4ProjectsIdIntegrationsZentao, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/zentao`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsZentao,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Squash Tm integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsSquashTm
    * @summary Create or update the Squash Tm integration
    * @request PUT:/api/v4/projects/{id}/integrations/squash-tm
    */
    putApiV4ProjectsIdIntegrationsSquashTm: (id, putApiV4ProjectsIdIntegrationsSquashTm, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/squash-tm`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsSquashTm,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Github integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsGithub
    * @summary Create or update the Github integration
    * @request PUT:/api/v4/projects/{id}/integrations/github
    */
    putApiV4ProjectsIdIntegrationsGithub: (id, putApiV4ProjectsIdIntegrationsGithub, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/github`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsGithub,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Git Guardian integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsGitGuardian
    * @summary Create or update the Git Guardian integration
    * @request PUT:/api/v4/projects/{id}/integrations/git-guardian
    */
    putApiV4ProjectsIdIntegrationsGitGuardian: (id, putApiV4ProjectsIdIntegrationsGitGuardian, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/git-guardian`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsGitGuardian,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Google Cloud Platform Artifact Registry integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsGoogleCloudPlatformArtifactRegistry
    * @summary Create or update the Google Cloud Platform Artifact Registry integration
    * @request PUT:/api/v4/projects/{id}/integrations/google-cloud-platform-artifact-registry
    */
    putApiV4ProjectsIdIntegrationsGoogleCloudPlatformArtifactRegistry: (id, putApiV4ProjectsIdIntegrationsGoogleCloudPlatformArtifactRegistry, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/google-cloud-platform-artifact-registry`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsGoogleCloudPlatformArtifactRegistry,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Google Cloud Platform Workload Identity Federation integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsGoogleCloudPlatformWorkloadIdentityFederation
    * @summary Create or update the Google Cloud Platform Workload Identity Federation integration
    * @request PUT:/api/v4/projects/{id}/integrations/google-cloud-platform-workload-identity-federation
    */
    putApiV4ProjectsIdIntegrationsGoogleCloudPlatformWorkloadIdentityFederation: (id, putApiV4ProjectsIdIntegrationsGoogleCloudPlatformWorkloadIdentityFederation, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/google-cloud-platform-workload-identity-federation`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsGoogleCloudPlatformWorkloadIdentityFederation,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Mock Ci integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsMockCi
    * @summary Create or update the Mock Ci integration
    * @request PUT:/api/v4/projects/{id}/integrations/mock-ci
    */
    putApiV4ProjectsIdIntegrationsMockCi: (id, putApiV4ProjectsIdIntegrationsMockCi, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/mock-ci`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsMockCi,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates the Mock Monitoring integration.
    *
    * @tags integrations
    * @name PutApiV4ProjectsIdIntegrationsMockMonitoring
    * @summary Create or update the Mock Monitoring integration
    * @request PUT:/api/v4/projects/{id}/integrations/mock-monitoring
    */
    putApiV4ProjectsIdIntegrationsMockMonitoring: (id, putApiV4ProjectsIdIntegrationsMockMonitoring, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/mock-monitoring`,
      method: "PUT",
      body: putApiV4ProjectsIdIntegrationsMockMonitoring,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Disables a specified integration. Integration settings are preserved.
    *
    * @tags integrations
    * @name DeleteApiV4ProjectsIdIntegrationsSlug
    * @summary Disable an integration
    * @request DELETE:/api/v4/projects/{id}/integrations/{slug}
    */
    deleteApiV4ProjectsIdIntegrationsSlug: (slug, id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/${slug}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Retrieves the settings for a specified integration.
    *
    * @tags integrations
    * @name GetApiV4ProjectsIdIntegrationsSlug
    * @summary Retrieve integration settings
    * @request GET:/api/v4/projects/{id}/integrations/{slug}
    */
    getApiV4ProjectsIdIntegrationsSlug: (slug, id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/${slug}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Triggers a slash command for mattermost-slash-commands.
    *
    * @tags integrations
    * @name PostApiV4ProjectsIdIntegrationsMattermostSlashCommandsTrigger
    * @summary Trigger a slash command for mattermost-slash-commands
    * @request POST:/api/v4/projects/{id}/integrations/mattermost_slash_commands/trigger
    */
    postApiV4ProjectsIdIntegrationsMattermostSlashCommandsTrigger: (id, postApiV4ProjectsIdIntegrationsMattermostSlashCommandsTrigger, params = {}) => this.request({
      path: `/api/v4/projects/${id}/integrations/mattermost_slash_commands/trigger`,
      method: "POST",
      body: postApiV4ProjectsIdIntegrationsMattermostSlashCommandsTrigger,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Adds a member to a project. You can specify a user ID or invite a user by email.
    *
    * @tags invitations
    * @name PostApiV4ProjectsIdInvitations
    * @summary Add a member to a project
    * @request POST:/api/v4/projects/{id}/invitations
    */
    postApiV4ProjectsIdInvitations: (id, postApiV4ProjectsIdInvitations, params = {}) => this.request({
      path: `/api/v4/projects/${id}/invitations`,
      method: "POST",
      body: postApiV4ProjectsIdInvitations,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all pending invitations for a specified project viewable by the authenticated user. Returns invitations to direct members only, and not through inherited ancestor groups. This function takes pagination parameters `page` and `per_page` to restrict the list of members.
    *
    * @tags invitations
    * @name GetApiV4ProjectsIdInvitations
    * @summary List all pending invitations for a project
    * @request GET:/api/v4/projects/{id}/invitations
    */
    getApiV4ProjectsIdInvitations: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/invitations`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Updates a pending invitation to a project.
    *
    * @tags invitations
    * @name PutApiV4ProjectsIdInvitationsEmail
    * @summary Update an invitation to a project
    * @request PUT:/api/v4/projects/{id}/invitations/{email}
    */
    putApiV4ProjectsIdInvitationsEmail: (id, email, putApiV4ProjectsIdInvitationsEmail, params = {}) => this.request({
      path: `/api/v4/projects/${id}/invitations/${email}`,
      method: "PUT",
      body: putApiV4ProjectsIdInvitationsEmail,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a pending invitation to a specified email address for a project.
    *
    * @tags invitations
    * @name DeleteApiV4ProjectsIdInvitationsEmail
    * @summary Delete an invitation to a project
    * @request DELETE:/api/v4/projects/{id}/invitations/{email}
    */
    deleteApiV4ProjectsIdInvitationsEmail: (id, email, params = {}) => this.request({
      path: `/api/v4/projects/${id}/invitations/${email}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all linked issues for a specified issue, sorted by the relationship creation datetime (ascending). Issues are filtered according to the user authorizations.
    *
    * @tags issues
    * @name GetApiV4ProjectsIdIssuesIssueIidLinks
    * @summary List all issue links
    * @request GET:/api/v4/projects/{id}/issues/{issue_iid}/links
    */
    getApiV4ProjectsIdIssuesIssueIidLinks: (id, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/links`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates a two-way relationship between two issues. The user must be allowed to update both issues to succeed.
    *
    * @tags issues
    * @name PostApiV4ProjectsIdIssuesIssueIidLinks
    * @summary Create an issue link
    * @request POST:/api/v4/projects/{id}/issues/{issue_iid}/links
    */
    postApiV4ProjectsIdIssuesIssueIidLinks: (id, issueIid, postApiV4ProjectsIdIssuesIssueIidLinks, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/links`,
      method: "POST",
      body: postApiV4ProjectsIdIssuesIssueIidLinks,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified issue link.
    *
    * @tags issues
    * @name GetApiV4ProjectsIdIssuesIssueIidLinksIssueLinkId
    * @summary Retrieve an issue link
    * @request GET:/api/v4/projects/{id}/issues/{issue_iid}/links/{issue_link_id}
    */
    getApiV4ProjectsIdIssuesIssueIidLinksIssueLinkId: (id, issueIid, issueLinkId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/links/${issueLinkId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified issue link, removing the two-way relationship.
    *
    * @tags issues
    * @name DeleteApiV4ProjectsIdIssuesIssueIidLinksIssueLinkId
    * @summary Delete an issue link
    * @request DELETE:/api/v4/projects/{id}/issues/{issue_iid}/links/{issue_link_id}
    */
    deleteApiV4ProjectsIdIssuesIssueIidLinksIssueLinkId: (id, issueIid, issueLinkId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/links/${issueLinkId}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description Sets an estimated time of work for a specified issue.
    *
    * @tags issues
    * @name PostApiV4ProjectsIdIssuesIssueIidTimeEstimate
    * @summary Set the estimated time for an issue
    * @request POST:/api/v4/projects/{id}/issues/{issue_iid}/time_estimate
    */
    postApiV4ProjectsIdIssuesIssueIidTimeEstimate: (id, issueIid, postApiV4ProjectsIdIssuesIssueIidTimeEstimate, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/time_estimate`,
      method: "POST",
      body: postApiV4ProjectsIdIssuesIssueIidTimeEstimate,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Resets the estimated time for a specified issue to `0` seconds.
    *
    * @tags issues
    * @name PostApiV4ProjectsIdIssuesIssueIidResetTimeEstimate
    * @summary Reset the estimated time for an issue
    * @request POST:/api/v4/projects/{id}/issues/{issue_iid}/reset_time_estimate
    */
    postApiV4ProjectsIdIssuesIssueIidResetTimeEstimate: (id, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/reset_time_estimate`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Adds spent time for a specified issue.
    *
    * @tags issues
    * @name PostApiV4ProjectsIdIssuesIssueIidAddSpentTime
    * @summary Add spent time for an issue
    * @request POST:/api/v4/projects/{id}/issues/{issue_iid}/add_spent_time
    */
    postApiV4ProjectsIdIssuesIssueIidAddSpentTime: (id, issueIid, postApiV4ProjectsIdIssuesIssueIidAddSpentTime, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/add_spent_time`,
      method: "POST",
      body: postApiV4ProjectsIdIssuesIssueIidAddSpentTime,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Resets the total spent time for a specified issue to `0` seconds.
    *
    * @tags issues
    * @name PostApiV4ProjectsIdIssuesIssueIidResetSpentTime
    * @summary Reset spent time for an issue
    * @request POST:/api/v4/projects/{id}/issues/{issue_iid}/reset_spent_time
    */
    postApiV4ProjectsIdIssuesIssueIidResetSpentTime: (id, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/reset_spent_time`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves time tracking stats for a specified issue, including time estimate and time spent in seconds and human-readable format (for example, `1h 30m`).
    *
    * @tags issues
    * @name GetApiV4ProjectsIdIssuesIssueIidTimeStats
    * @summary Retrieve time tracking stats for an issue
    * @request GET:/api/v4/projects/{id}/issues/{issue_iid}/time_stats
    */
    getApiV4ProjectsIdIssuesIssueIidTimeStats: (id, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/time_stats`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all issues for a specified project. If the project is private, you need to provide credentials to authorize. In most cases, you should authenticate with a personal access token.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdIssues
    * @summary List all project issues
    * @request GET:/api/v4/projects/{id}/issues
    */
    getApiV4ProjectsIdIssues: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates an issue for a specified project.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdIssues
    * @summary Create an issue
    * @request POST:/api/v4/projects/{id}/issues
    */
    postApiV4ProjectsIdIssues: (id, postApiV4ProjectsIdIssues, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues`,
      method: "POST",
      body: postApiV4ProjectsIdIssues,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves statistics for issues in a specified project.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdIssuesStatistics
    * @summary Retrieve issues statistics for a project
    * @request GET:/api/v4/projects/{id}/issues_statistics
    */
    getApiV4ProjectsIdIssuesStatistics: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues_statistics`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Retrieves a specified issue for a project. If the project is private or the issue is confidential, you need to provide credentials to authorize. In most cases, you should authenticate with a personal access token.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdIssuesIssueIid
    * @summary Retrieve a project issue
    * @request GET:/api/v4/projects/{id}/issues/{issue_iid}
    */
    getApiV4ProjectsIdIssuesIssueIid: (id, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified issue for a project. This request is also used to close or reopen an issue using the `state_event` parameter. At least one of the following parameters is required for the request to be successful: `assignee_id`, `assignee_ids`, `confidential`, `created_at`, `description`, `discussion_locked`, `due_date`, `issue_type`, `labels`, `milestone_id`, `state_event`, `title`.
    *
    * @tags projects
    * @name PutApiV4ProjectsIdIssuesIssueIid
    * @summary Update an issue
    * @request PUT:/api/v4/projects/{id}/issues/{issue_iid}
    */
    putApiV4ProjectsIdIssuesIssueIid: (id, issueIid, putApiV4ProjectsIdIssuesIssueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}`,
      method: "PUT",
      body: putApiV4ProjectsIdIssuesIssueIid,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified issue.
    *
    * @tags projects
    * @name DeleteApiV4ProjectsIdIssuesIssueIid
    * @summary Delete an issue
    * @request DELETE:/api/v4/projects/{id}/issues/{issue_iid}
    */
    deleteApiV4ProjectsIdIssuesIssueIid: (id, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Updates the order of a specified issue in a project. You can see the results when sorting issues manually.
    *
    * @tags projects
    * @name PutApiV4ProjectsIdIssuesIssueIidReorder
    * @summary Update the order of an issue
    * @request PUT:/api/v4/projects/{id}/issues/{issue_iid}/reorder
    */
    putApiV4ProjectsIdIssuesIssueIidReorder: (id, issueIid, putApiV4ProjectsIdIssuesIssueIidReorder, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/reorder`,
      method: "PUT",
      body: putApiV4ProjectsIdIssuesIssueIidReorder,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Moves a specified issue to a different project. If the target project is the source project or the user has insufficient permissions, an error message with status code `400` is returned. If a label or milestone with the same name also exists in the target project, it is then assigned to the issue being moved.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdIssuesIssueIidMove
    * @summary Move an issue
    * @request POST:/api/v4/projects/{id}/issues/{issue_iid}/move
    */
    postApiV4ProjectsIdIssuesIssueIidMove: (id, issueIid, postApiV4ProjectsIdIssuesIssueIidMove, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/move`,
      method: "POST",
      body: postApiV4ProjectsIdIssuesIssueIidMove,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Clones a specified issue to a project. Copies as much data as possible as long as the target project contains equivalent criteria, such as labels or milestones. If you have insufficient permissions, an error message with status code `400` is returned.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdIssuesIssueIidClone
    * @summary Clone an issue
    * @request POST:/api/v4/projects/{id}/issues/{issue_iid}/clone
    */
    postApiV4ProjectsIdIssuesIssueIidClone: (id, issueIid, postApiV4ProjectsIdIssuesIssueIidClone, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/clone`,
      method: "POST",
      body: postApiV4ProjectsIdIssuesIssueIidClone,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all merge requests that are related to a specified issue. If the project is private or the issue is confidential, you need to provide credentials to authorize. In most cases, you should authenticate with a personal access token.
    *
    * @tags issues
    * @name GetApiV4ProjectsIdIssuesIssueIidRelatedMergeRequests
    * @summary List all merge requests related to an issue
    * @request GET:/api/v4/projects/{id}/issues/{issue_iid}/related_merge_requests
    */
    getApiV4ProjectsIdIssuesIssueIidRelatedMergeRequests: (id, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/related_merge_requests`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all merge requests that close a specified issue when merged. If the project is private or the issue is confidential, you need to provide credentials to authorize. In most cases, you should authenticate with a personal access token.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdIssuesIssueIidClosedBy
    * @summary List all merge requests that close an issue on merge
    * @request GET:/api/v4/projects/{id}/issues/{issue_iid}/closed_by
    */
    getApiV4ProjectsIdIssuesIssueIidClosedBy: (id, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/closed_by`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all users that are participants in a specified issue. If the project is private or the issue is confidential, you need to provide credentials to authorize. In most cases, you should authenticate with a personal access token.
    *
    * @tags issues
    * @name GetApiV4ProjectsIdIssuesIssueIidParticipants
    * @summary List all participants in an issue
    * @request GET:/api/v4/projects/{id}/issues/{issue_iid}/participants
    */
    getApiV4ProjectsIdIssuesIssueIidParticipants: (id, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/participants`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves user agent details for an issue.
    *
    * @tags issues
    * @name GetApiV4ProjectsIdIssuesIssueIidUserAgentDetail
    * @summary Retrieve user agent details for an issue
    * @request GET:/api/v4/projects/{id}/issues/{issue_iid}/user_agent_detail
    */
    getApiV4ProjectsIdIssuesIssueIidUserAgentDetail: (id, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/user_agent_detail`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Authorizes uploading a metric image for a specified incident.
    *
    * @tags metric_images
    * @name PostApiV4ProjectsIdIssuesIssueIidMetricImagesAuthorize
    * @summary Authorize metric image upload
    * @request POST:/api/v4/projects/{id}/issues/{issue_iid}/metric_images/authorize
    */
    postApiV4ProjectsIdIssuesIssueIidMetricImagesAuthorize: (id, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/metric_images/authorize`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Uploads a screenshot of metric charts for an incident. Available only for incidents.
    *
    * @tags metric_images
    * @name PostApiV4ProjectsIdIssuesIssueIidMetricImages
    * @summary Upload a metric image for an incident
    * @request POST:/api/v4/projects/{id}/issues/{issue_iid}/metric_images
    */
    postApiV4ProjectsIdIssuesIssueIidMetricImages: (id, issueIid, postApiV4ProjectsIdIssuesIssueIidMetricImages, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/metric_images`,
      method: "POST",
      body: postApiV4ProjectsIdIssuesIssueIidMetricImages,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all metric images for an incident.
    *
    * @tags metric_images
    * @name GetApiV4ProjectsIdIssuesIssueIidMetricImages
    * @summary List all metric images for an incident
    * @request GET:/api/v4/projects/{id}/issues/{issue_iid}/metric_images
    */
    getApiV4ProjectsIdIssuesIssueIidMetricImages: (id, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/metric_images`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a metric image for an incident.
    *
    * @tags metric_images
    * @name PutApiV4ProjectsIdIssuesIssueIidMetricImagesMetricImageId
    * @summary Update a metric image for an incident
    * @request PUT:/api/v4/projects/{id}/issues/{issue_iid}/metric_images/{metric_image_id}
    */
    putApiV4ProjectsIdIssuesIssueIidMetricImagesMetricImageId: (id, metricImageId, issueIid, putApiV4ProjectsIdIssuesIssueIidMetricImagesMetricImageId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/metric_images/${metricImageId}`,
      method: "PUT",
      body: putApiV4ProjectsIdIssuesIssueIidMetricImagesMetricImageId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a metric image from an incident.
    *
    * @tags metric_images
    * @name DeleteApiV4ProjectsIdIssuesIssueIidMetricImagesMetricImageId
    * @summary Delete a metric image from an incident
    * @request DELETE:/api/v4/projects/{id}/issues/{issue_iid}/metric_images/{metric_image_id}
    */
    deleteApiV4ProjectsIdIssuesIssueIidMetricImagesMetricImageId: (id, metricImageId, issueIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${issueIid}/metric_images/${metricImageId}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description Validates the `.gitlab-ci.yml` configuration for a specified project.
    *
    * @tags ci_lint
    * @name GetApiV4ProjectsIdCiLint
    * @summary Validate existing CI/CD configuration
    * @request GET:/api/v4/projects/{id}/ci/lint
    */
    getApiV4ProjectsIdCiLint: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/ci/lint`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Validates a provided CI/CD configuration in the context of a specified project.
    *
    * @tags ci_lint
    * @name PostApiV4ProjectsIdCiLint
    * @summary Validate a CI/CD configuration
    * @request POST:/api/v4/projects/{id}/ci/lint
    */
    postApiV4ProjectsIdCiLint: (id, postApiV4ProjectsIdCiLint, params = {}) => this.request({
      path: `/api/v4/projects/${id}/ci/lint`,
      method: "POST",
      body: postApiV4ProjectsIdCiLint,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.11
    *
    * @tags projects
    * @name PostApiV4ProjectsIdUploadsAuthorize
    * @summary Workhorse authorize the file upload
    * @request POST:/api/v4/projects/{id}/uploads/authorize
    */
    postApiV4ProjectsIdUploadsAuthorize: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/uploads/authorize`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Creates an upload.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdUploads
    * @summary Create an upload
    * @request POST:/api/v4/projects/{id}/uploads
    */
    postApiV4ProjectsIdUploads: (id, postApiV4ProjectsIdUploads, params = {}) => this.request({
      path: `/api/v4/projects/${id}/uploads`,
      method: "POST",
      body: postApiV4ProjectsIdUploads,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all uploads of a project sorted by `created_at` in descending order. You must have the Maintainer or Owner role for the project.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdUploads
    * @summary List all uploads
    * @request GET:/api/v4/projects/{id}/uploads
    */
    getApiV4ProjectsIdUploads: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/uploads`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Downloads an uploaded file with a specified ID. You must have the Maintainer or Owner role for the project.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdUploadsUploadId
    * @summary Download an uploaded file by ID
    * @request GET:/api/v4/projects/{id}/uploads/{upload_id}
    */
    getApiV4ProjectsIdUploadsUploadId: (id, uploadId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/uploads/${uploadId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes an uploaded file with a specified ID. You must have the Maintainer or Owner role for the project.
    *
    * @tags projects
    * @name DeleteApiV4ProjectsIdUploadsUploadId
    * @summary Delete an uploaded file by ID
    * @request DELETE:/api/v4/projects/{id}/uploads/{upload_id}
    */
    deleteApiV4ProjectsIdUploadsUploadId: (id, uploadId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/uploads/${uploadId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Downloads an uploaded file with a specified secret and filename. You must have the Guest, Planner, Reporter, Developer, Maintainer, or Owner role for the project.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdUploadsSecretFilename
    * @summary Download an uploaded file by secret and filename
    * @request GET:/api/v4/projects/{id}/uploads/{secret}/{filename}
    */
    getApiV4ProjectsIdUploadsSecretFilename: (id, secret, filename, params = {}) => this.request({
      path: `/api/v4/projects/${id}/uploads/${secret}/${filename}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes an uploaded file with a specified secret and filename. You must have the Maintainer or Owner role for the project.
    *
    * @tags projects
    * @name DeleteApiV4ProjectsIdUploadsSecretFilename
    * @summary Delete an uploaded file by secret and filename
    * @request DELETE:/api/v4/projects/{id}/uploads/{secret}/{filename}
    */
    deleteApiV4ProjectsIdUploadsSecretFilename: (id, secret, filename, params = {}) => this.request({
      path: `/api/v4/projects/${id}/uploads/${secret}/${filename}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 11.3
    *
    * @tags packages
    * @name GetApiV4ProjectsIdPackagesMavenPathFileName
    * @summary Download the maven package file at a project level
    * @request GET:/api/v4/projects/{id}/packages/maven/*path/{file_name}
    */
    getApiV4ProjectsIdPackagesMavenPathFileName: (id, fileName, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/maven/*path/${fileName}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 11.3
    *
    * @tags packages
    * @name PutApiV4ProjectsIdPackagesMavenPathFileName
    * @summary Upload the maven package file
    * @request PUT:/api/v4/projects/{id}/packages/maven/*path/{file_name}
    */
    putApiV4ProjectsIdPackagesMavenPathFileName: (id, fileName, putApiV4ProjectsIdPackagesMavenpathFileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/maven/*path/${fileName}`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesMavenpathFileName,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 11.3
    *
    * @tags packages
    * @name PutApiV4ProjectsIdPackagesMavenPathFileNameAuthorize
    * @summary Workhorse authorize the maven package file upload
    * @request PUT:/api/v4/projects/{id}/packages/maven/*path/{file_name}/authorize
    */
    putApiV4ProjectsIdPackagesMavenPathFileNameAuthorize: (id, fileName, putApiV4ProjectsIdPackagesMavenpathFileNameAuthorize, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/maven/*path/${fileName}/authorize`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesMavenpathFileNameAuthorize,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all direct members of a specified project viewable by the authenticated user. Does not return inherited members from ancestor groups or invited groups.
    *
    * @tags members
    * @name GetApiV4ProjectsIdMembers
    * @summary List all direct members of a project
    * @request GET:/api/v4/projects/{id}/members
    */
    getApiV4ProjectsIdMembers: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/members`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds a member to a specified project.
    *
    * @tags members
    * @name PostApiV4ProjectsIdMembers
    * @summary Add a member to a project
    * @request POST:/api/v4/projects/{id}/members
    */
    postApiV4ProjectsIdMembers: (id, postApiV4ProjectsIdMembers, params = {}) => this.request({
      path: `/api/v4/projects/${id}/members`,
      method: "POST",
      body: postApiV4ProjectsIdMembers,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all members of a specified project viewable by the authenticated user. Also returns inherited members from ancestor groups or invited groups. If a user is a member of this project and one or more ancestor groups, only returns the highest `access_level`. Members from an invited group are returned if the invited group is public, the requester is a member of an invited group, or the requester is a member of the shared group or project.
    *
    * @tags members
    * @name GetApiV4ProjectsIdMembersAll
    * @summary List all members of a project
    * @request GET:/api/v4/projects/{id}/members/all
    */
    getApiV4ProjectsIdMembersAll: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/members/all`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified member of a project. Returns only direct members and not inherited members through ancestor groups.
    *
    * @tags members
    * @name GetApiV4ProjectsIdMembersUserId
    * @summary Retrieve a direct project member
    * @request GET:/api/v4/projects/{id}/members/{user_id}
    */
    getApiV4ProjectsIdMembersUserId: (id, userId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/members/${userId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified member of a project.
    *
    * @tags members
    * @name PutApiV4ProjectsIdMembersUserId
    * @summary Update a project member
    * @request PUT:/api/v4/projects/{id}/members/{user_id}
    */
    putApiV4ProjectsIdMembersUserId: (id, userId, putApiV4ProjectsIdMembersUserId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/members/${userId}`,
      method: "PUT",
      body: putApiV4ProjectsIdMembersUserId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Removes a specified user from a project. The user must be a direct member.
    *
    * @tags members
    * @name DeleteApiV4ProjectsIdMembersUserId
    * @summary Remove a member from a project
    * @request DELETE:/api/v4/projects/{id}/members/{user_id}
    */
    deleteApiV4ProjectsIdMembersUserId: (id, userId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/members/${userId}`,
      method: "DELETE",
      query,
      ...params
    }),
    /**
    * @description Retrieves a specified member of a project. Returns direct members and members inherited or invited through ancestor groups.
    *
    * @tags members
    * @name GetApiV4ProjectsIdMembersAllUserId
    * @summary Retrieve a project member
    * @request GET:/api/v4/projects/{id}/members/all/{user_id}
    */
    getApiV4ProjectsIdMembersAllUserId: (id, userId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/members/all/${userId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates a merge request to add CI configuration to a specified project.
    *
    * @tags projects, merge_requests
    * @name PostApiV4ProjectsIdCreateCiConfig
    * @summary Create a CI configuration merge request
    * @request POST:/api/v4/projects/{id}/create_ci_config
    */
    postApiV4ProjectsIdCreateCiConfig: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/create_ci_config`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Sets an estimated time of work for a specified merge request.
    *
    * @tags merge_requests
    * @name PostApiV4ProjectsIdMergeRequestsMergeRequestIidTimeEstimate
    * @summary Set the estimated time for a merge request
    * @request POST:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/time_estimate
    */
    postApiV4ProjectsIdMergeRequestsMergeRequestIidTimeEstimate: (id, mergeRequestIid, postApiV4ProjectsIdMergeRequestsMergeRequestIidTimeEstimate, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/time_estimate`,
      method: "POST",
      body: postApiV4ProjectsIdMergeRequestsMergeRequestIidTimeEstimate,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Resets the estimated time for a specified merge request to `0` seconds.
    *
    * @tags merge_requests
    * @name PostApiV4ProjectsIdMergeRequestsMergeRequestIidResetTimeEstimate
    * @summary Reset the estimated time for a merge request
    * @request POST:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/reset_time_estimate
    */
    postApiV4ProjectsIdMergeRequestsMergeRequestIidResetTimeEstimate: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/reset_time_estimate`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Adds spent time for a specified merge request.
    *
    * @tags merge_requests
    * @name PostApiV4ProjectsIdMergeRequestsMergeRequestIidAddSpentTime
    * @summary Add spent time for a merge request
    * @request POST:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/add_spent_time
    */
    postApiV4ProjectsIdMergeRequestsMergeRequestIidAddSpentTime: (id, mergeRequestIid, postApiV4ProjectsIdMergeRequestsMergeRequestIidAddSpentTime, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/add_spent_time`,
      method: "POST",
      body: postApiV4ProjectsIdMergeRequestsMergeRequestIidAddSpentTime,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Resets the total spent time for a specified merge request to `0` seconds.
    *
    * @tags merge_requests
    * @name PostApiV4ProjectsIdMergeRequestsMergeRequestIidResetSpentTime
    * @summary Reset spent time for a merge request
    * @request POST:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/reset_spent_time
    */
    postApiV4ProjectsIdMergeRequestsMergeRequestIidResetSpentTime: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/reset_spent_time`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves time tracking stats for a specified merge request, including time estimate and time spent in seconds and human-readable format (for example, `1h 30m`).
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidTimeStats
    * @summary Retrieve time tracking stats for a merge request
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/time_stats
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidTimeStats: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/time_stats`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all project merge requests.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequests
    * @summary List all project merge requests
    * @request GET:/api/v4/projects/{id}/merge_requests
    */
    getApiV4ProjectsIdMergeRequests: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a merge request for a project.
    *
    * @tags merge_requests
    * @name PostApiV4ProjectsIdMergeRequests
    * @summary Create a merge request
    * @request POST:/api/v4/projects/{id}/merge_requests
    */
    postApiV4ProjectsIdMergeRequests: (id, postApiV4ProjectsIdMergeRequests, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests`,
      method: "POST",
      body: postApiV4ProjectsIdMergeRequests,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified merge request for a project. Administrators and project Owners only.
    *
    * @tags merge_requests
    * @name DeleteApiV4ProjectsIdMergeRequestsMergeRequestIid
    * @summary Delete a merge request
    * @request DELETE:/api/v4/projects/{id}/merge_requests/{merge_request_iid}
    */
    deleteApiV4ProjectsIdMergeRequestsMergeRequestIid: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Retrieves a merge request for a specified project.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIid
    * @summary Retrieve a merge request
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIid: (id, mergeRequestIid, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Updates a merge request for a specified project.
    *
    * @tags merge_requests
    * @name PutApiV4ProjectsIdMergeRequestsMergeRequestIid
    * @summary Update a merge request
    * @request PUT:/api/v4/projects/{id}/merge_requests/{merge_request_iid}
    */
    putApiV4ProjectsIdMergeRequestsMergeRequestIid: (id, mergeRequestIid, putApiV4ProjectsIdMergeRequestsMergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}`,
      method: "PUT",
      body: putApiV4ProjectsIdMergeRequestsMergeRequestIid,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves participants for a specified merge request.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidParticipants
    * @summary Retrieve merge request participants
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/participants
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidParticipants: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/participants`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves reviewers for a specified merge request.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidReviewers
    * @summary Retrieve merge request reviewers
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/reviewers
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidReviewers: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/reviewers`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves commits for a specified merge request.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidCommits
    * @summary Retrieve merge request commits
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/commits
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidCommits: (id, mergeRequestIid, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/commits`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all context commits for a specified merge request.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidContextCommits
    * @summary List all context commits for a merge request
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/context_commits
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidContextCommits: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/context_commits`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates context commits for a specified merge request.
    *
    * @tags merge_requests
    * @name PostApiV4ProjectsIdMergeRequestsMergeRequestIidContextCommits
    * @summary Create context commits for a merge request
    * @request POST:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/context_commits
    */
    postApiV4ProjectsIdMergeRequestsMergeRequestIidContextCommits: (id, mergeRequestIid, postApiV4ProjectsIdMergeRequestsMergeRequestIidContextCommits, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/context_commits`,
      method: "POST",
      body: postApiV4ProjectsIdMergeRequestsMergeRequestIidContextCommits,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes specified context commits from a merge request.
    *
    * @tags merge_requests
    * @name DeleteApiV4ProjectsIdMergeRequestsMergeRequestIidContextCommits
    * @summary Delete context commits from a merge request
    * @request DELETE:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/context_commits
    */
    deleteApiV4ProjectsIdMergeRequestsMergeRequestIidContextCommits: (id, mergeRequestIid, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/context_commits`,
      method: "DELETE",
      query,
      ...params
    }),
    /**
    * @description Retrieves changes for a specified merge request.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidChanges
    * @summary Retrieve merge request changes
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/changes
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidChanges: (id, mergeRequestIid, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/changes`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all merge request diffs.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidDiffs
    * @summary List all merge request diffs
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/diffs
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidDiffs: (id, mergeRequestIid, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/diffs`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the raw diffs of the files changed in a merge request.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidRawDiffs
    * @summary Retrieve merge request raw diffs
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/raw_diffs
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidRawDiffs: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/raw_diffs`,
      method: "GET",
      ...params
    }),
    /**
    * @description Lists all merge request pipelines.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidPipelines
    * @summary List all merge request pipelines
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/pipelines
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidPipelines: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/pipelines`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates a merge request pipeline. Pipelines created with this operation must configure `.gitlab-ci.yml` with `only: [merge_requests]` to create jobs.
    *
    * @tags merge_requests
    * @name PostApiV4ProjectsIdMergeRequestsMergeRequestIidPipelines
    * @summary Create a merge request pipeline
    * @request POST:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/pipelines
    */
    postApiV4ProjectsIdMergeRequestsMergeRequestIidPipelines: (id, mergeRequestIid, postApiV4ProjectsIdMergeRequestsMergeRequestIidPipelines, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/pipelines`,
      method: "POST",
      body: postApiV4ProjectsIdMergeRequestsMergeRequestIidPipelines,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Merges a merge request. Accepts and merges changes submitted with the merge request.
    *
    * @tags merge_requests
    * @name PutApiV4ProjectsIdMergeRequestsMergeRequestIidMerge
    * @summary Merge a merge request
    * @request PUT:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/merge
    */
    putApiV4ProjectsIdMergeRequestsMergeRequestIidMerge: (id, mergeRequestIid, putApiV4ProjectsIdMergeRequestsMergeRequestIidMerge, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/merge`,
      method: "PUT",
      body: putApiV4ProjectsIdMergeRequestsMergeRequestIidMerge,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Merges the changes between the merge request source and target branches into the `refs/merge-requests/:iid/merge` ref, of the target project repository, if possible. This ref has the state the target branch would have if a regular merge action was taken.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidMergeRef
    * @summary Merge to default merge ref path
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/merge_ref
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidMergeRef: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/merge_ref`,
      method: "GET",
      ...params
    }),
    /**
    * @description Cancels an automatic merge for a merge request that has been set to merge when the pipeline succeeds.
    *
    * @tags merge_requests
    * @name PostApiV4ProjectsIdMergeRequestsMergeRequestIidCancelMergeWhenPipelineSucceeds
    * @summary Cancel merge when pipeline succeeds
    * @request POST:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/cancel_merge_when_pipeline_succeeds
    */
    postApiV4ProjectsIdMergeRequestsMergeRequestIidCancelMergeWhenPipelineSucceeds: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/cancel_merge_when_pipeline_succeeds`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Rebases a merge request. Automatically rebases the `source_branch` of the merge request against its `target_branch`.
    *
    * @tags merge_requests
    * @name PutApiV4ProjectsIdMergeRequestsMergeRequestIidRebase
    * @summary Rebase a merge request
    * @request PUT:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/rebase
    */
    putApiV4ProjectsIdMergeRequestsMergeRequestIidRebase: (id, mergeRequestIid, putApiV4ProjectsIdMergeRequestsMergeRequestIidRebase, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/rebase`,
      method: "PUT",
      body: putApiV4ProjectsIdMergeRequestsMergeRequestIidRebase,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all issues that close on merge.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidClosesIssues
    * @summary List all issues that close on merge
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/closes_issues
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidClosesIssues: (id, mergeRequestIid, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/closes_issues`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all issues related to the merge request.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidRelatedIssues
    * @summary List all issues related to the merge request
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/related_issues
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidRelatedIssues: (id, mergeRequestIid, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/related_issues`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Retrieves the approval state for a specified merge request. In the response, `approved_by` contains information about all approvers of the merge request, regardless of whether those approvals satisfy any approval rule.
    *
    * @tags merge_request_approvals
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidApprovals
    * @summary Retrieve approval state for a merge request
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/approvals
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidApprovals: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/approvals`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deprecated in 16.0. Use the merge request approvals API instead.
    *
    * @tags merge_request_approvals
    * @name PostApiV4ProjectsIdMergeRequestsMergeRequestIidApprovals
    * @summary Change approval-related configuration
    * @request POST:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/approvals
    * @deprecated
    */
    postApiV4ProjectsIdMergeRequestsMergeRequestIidApprovals: (id, mergeRequestIid, postApiV4ProjectsIdMergeRequestsMergeRequestIidApprovals, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/approvals`,
      method: "POST",
      body: postApiV4ProjectsIdMergeRequestsMergeRequestIidApprovals,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Approves a specified merge request. The currently authenticated user must be an eligible approver. The `sha` parameter ensures you are approving the current version of the merge request. If defined, the value must match the merge request’s HEAD commit SHA. A mismatch returns a `409 Conflict` response.
    *
    * @tags merge_request_approvals
    * @name PostApiV4ProjectsIdMergeRequestsMergeRequestIidApprove
    * @summary Approve merge request
    * @request POST:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/approve
    */
    postApiV4ProjectsIdMergeRequestsMergeRequestIidApprove: (id, mergeRequestIid, postApiV4ProjectsIdMergeRequestsMergeRequestIidApprove, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/approve`,
      method: "POST",
      body: postApiV4ProjectsIdMergeRequestsMergeRequestIidApprove,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Unapproves a merge request. Removes the approval for the currently authenticated user from a specified merge request.
    *
    * @tags merge_request_approvals
    * @name PostApiV4ProjectsIdMergeRequestsMergeRequestIidUnapprove
    * @summary Unapprove a merge request
    * @request POST:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/unapprove
    */
    postApiV4ProjectsIdMergeRequestsMergeRequestIidUnapprove: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/unapprove`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Resets all approvals for a specified merge request. Available only to bot users with a valid project or group token. Human users receive a `401 Unauthorized` response.
    *
    * @tags merge_request_approvals
    * @name PutApiV4ProjectsIdMergeRequestsMergeRequestIidResetApprovals
    * @summary Reset approvals for a merge request
    * @request PUT:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/reset_approvals
    */
    putApiV4ProjectsIdMergeRequestsMergeRequestIidResetApprovals: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/reset_approvals`,
      method: "PUT",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Retrieves approval details for a specified merge request. If a user has modified the approval rules for the merge request, the response includes `approval_rules_overwritten`.
    *
    * @tags merge_request_approvals
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidApprovalState
    * @summary Retrieve approval details for a merge request
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/approval_state
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidApprovalState: (id, mergeRequestIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/approval_state`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves merge request diff versions.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidVersions
    * @summary Retrieve merge request diff versions
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/versions
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidVersions: (id, mergeRequestIid, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/versions`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a merge request diff version.
    *
    * @tags merge_requests
    * @name GetApiV4ProjectsIdMergeRequestsMergeRequestIidVersionsVersionId
    * @summary Retrieve a merge request diff version
    * @request GET:/api/v4/projects/{id}/merge_requests/{merge_request_iid}/versions/{version_id}
    */
    getApiV4ProjectsIdMergeRequestsMergeRequestIidVersionsVersionId: (id, mergeRequestIid, versionId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${mergeRequestIid}/versions/${versionId}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Introduced in GitLab 16.8
    *
    * @tags ml_model_registry
    * @name PutApiV4ProjectsIdPackagesMlModelsModelVersionIdFilesPathFileNameAuthorize
    * @summary Workhorse authorize model package file
    * @request PUT:/api/v4/projects/{id}/packages/ml_models/{model_version_id}/files/(*path/){file_name}/authorize
    */
    putApiV4ProjectsIdPackagesMlModelsModelVersionIdFilesPathFileNameAuthorize: (id, fileName, modelVersionId, putApiV4ProjectsIdPackagesMlModelsModelVersionIdFilesUpathFileNameAuthorize, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/ml_models/${modelVersionId}/files/(*path/)${fileName}/authorize`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesMlModelsModelVersionIdFilesUpathFileNameAuthorize,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Introduced in GitLab 16.8
    *
    * @tags ml_model_registry
    * @name PutApiV4ProjectsIdPackagesMlModelsModelVersionIdFilesPathFileName
    * @summary Workhorse upload model package file
    * @request PUT:/api/v4/projects/{id}/packages/ml_models/{model_version_id}/files/(*path/){file_name}
    */
    putApiV4ProjectsIdPackagesMlModelsModelVersionIdFilesPathFileName: (id, fileName, modelVersionId, putApiV4ProjectsIdPackagesMlModelsModelVersionIdFilesUpathFileName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/ml_models/${modelVersionId}/files/(*path/)${fileName}`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesMlModelsModelVersionIdFilesUpathFileName,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 16.8
    *
    * @tags ml_model_registry
    * @name GetApiV4ProjectsIdPackagesMlModelsModelVersionIdFilesPathFileName
    * @summary Download an ml_model package file
    * @request GET:/api/v4/projects/{id}/packages/ml_models/{model_version_id}/files/(*path/){file_name}
    */
    getApiV4ProjectsIdPackagesMlModelsModelVersionIdFilesPathFileName: (id, fileName, modelVersionId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/ml_models/${modelVersionId}/files/(*path/)${fileName}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.7
    *
    * @tags packages_npm
    * @name GetApiV4ProjectsIdPackagesNpmPackagePackageNameDistTags
    * @summary Get all tags for a given an NPM package
    * @request GET:/api/v4/projects/{id}/packages/npm/-/package/*package_name/dist-tags
    */
    getApiV4ProjectsIdPackagesNpmPackagePackageNameDistTags: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/npm/-/package/*package_name/dist-tags`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.7
    *
    * @tags packages_npm
    * @name PutApiV4ProjectsIdPackagesNpmPackagePackageNameDistTagsTag
    * @summary Create or Update the given tag for the given NPM package and version
    * @request PUT:/api/v4/projects/{id}/packages/npm/-/package/*package_name/dist-tags/{tag}
    */
    putApiV4ProjectsIdPackagesNpmPackagePackageNameDistTagsTag: (id, tag, putApiV4ProjectsIdPackagesNpmPackagepackageNameDistTagsTag, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/npm/-/package/*package_name/dist-tags/${tag}`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesNpmPackagepackageNameDistTagsTag,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.7
    *
    * @tags packages_npm
    * @name DeleteApiV4ProjectsIdPackagesNpmPackagePackageNameDistTagsTag
    * @summary Deletes the given tag
    * @request DELETE:/api/v4/projects/{id}/packages/npm/-/package/*package_name/dist-tags/{tag}
    */
    deleteApiV4ProjectsIdPackagesNpmPackagePackageNameDistTagsTag: (id, tag, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/npm/-/package/*package_name/dist-tags/${tag}`,
      method: "DELETE",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.6
    *
    * @tags packages_npm
    * @name PostApiV4ProjectsIdPackagesNpmNpmV1SecurityAdvisoriesBulk
    * @summary NPM registry bulk advisory endpoint
    * @request POST:/api/v4/projects/{id}/packages/npm/-/npm/v1/security/advisories/bulk
    */
    postApiV4ProjectsIdPackagesNpmNpmV1SecurityAdvisoriesBulk: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/npm/-/npm/v1/security/advisories/bulk`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.6
    *
    * @tags packages_npm
    * @name PostApiV4ProjectsIdPackagesNpmNpmV1SecurityAuditsQuick
    * @summary NPM registry quick audit endpoint
    * @request POST:/api/v4/projects/{id}/packages/npm/-/npm/v1/security/audits/quick
    */
    postApiV4ProjectsIdPackagesNpmNpmV1SecurityAuditsQuick: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/npm/-/npm/v1/security/audits/quick`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 11.8
    *
    * @tags packages_npm
    * @name GetApiV4ProjectsIdPackagesNpmPackageNameFileName
    * @summary Download the NPM tarball
    * @request GET:/api/v4/projects/{id}/packages/npm/*package_name/-/*file_name
    */
    getApiV4ProjectsIdPackagesNpmPackageNameFileName: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/npm/*package_name/-/*file_name`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Creates or deprecates an NPM package for a specified project. Deprecate support was added in GitLab 16.0.
    *
    * @tags packages_npm
    * @name PutApiV4ProjectsIdPackagesNpmPackageName
    * @summary Create or deprecate an NPM package
    * @request PUT:/api/v4/projects/{id}/packages/npm/{package_name}
    */
    putApiV4ProjectsIdPackagesNpmPackageName: (id, packageName, putApiV4ProjectsIdPackagesNpmPackageName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/npm/${packageName}`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesNpmPackageName,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 11.8
    *
    * @tags packages_npm
    * @name GetApiV4ProjectsIdPackagesNpmPackageName
    * @summary NPM registry metadata endpoint
    * @request GET:/api/v4/projects/{id}/packages/npm/*package_name
    */
    getApiV4ProjectsIdPackagesNpmPackageName: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/npm/*package_name`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.6
    *
    * @tags packages_nuget
    * @name GetApiV4ProjectsIdPackagesNugetIndex
    * @summary The NuGet V3 Feed Service Index
    * @request GET:/api/v4/projects/{id}/packages/nuget/index
    */
    getApiV4ProjectsIdPackagesNugetIndex: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/index`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 16.7
    *
    * @tags packages_nuget
    * @name GetApiV4ProjectsIdPackagesNugetSymbolfilesFileNameSignatureSameFileName
    * @summary The NuGet Symbol File Download Endpoint
    * @request GET:/api/v4/projects/{id}/packages/nuget/symbolfiles/*file_name/*signature/*same_file_name
    */
    getApiV4ProjectsIdPackagesNugetSymbolfilesFileNameSignatureSameFileName: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/symbolfiles/*file_name/*signature/*same_file_name`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 16.2
    *
    * @tags packages_nuget
    * @name GetApiV4ProjectsIdPackagesNugetV2
    * @summary The NuGet V2 Feed Service Index
    * @request GET:/api/v4/projects/{id}/packages/nuget/v2
    */
    getApiV4ProjectsIdPackagesNugetV2: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/v2`,
      method: "GET",
      ...params
    }),
    /**
    * @description Uploads a NuGet v2 package file for a specified project.
    *
    * @tags packages_nuget
    * @name PutApiV4ProjectsIdPackagesNugetV2
    * @summary Upload a NuGet v2 package file for a project
    * @request PUT:/api/v4/projects/{id}/packages/nuget/v2
    */
    putApiV4ProjectsIdPackagesNugetV2: (id, putApiV4ProjectsIdPackagesNugetV2, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/v2`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesNugetV2,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 16.3
    *
    * @tags packages_nuget
    * @name GetApiV4ProjectsIdPackagesNugetV2Metadata
    * @summary The NuGet V2 Feed Package $metadata endpoint
    * @request GET:/api/v4/projects/{id}/packages/nuget/v2/$metadata
    */
    getApiV4ProjectsIdPackagesNugetV2Metadata: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/v2/$metadata`,
      method: "GET",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.8
    *
    * @tags packages_nuget
    * @name GetApiV4ProjectsIdPackagesNugetMetadataPackageNameIndex
    * @summary The NuGet Metadata Service - Package name level
    * @request GET:/api/v4/projects/{id}/packages/nuget/metadata/*package_name/index
    */
    getApiV4ProjectsIdPackagesNugetMetadataPackageNameIndex: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/metadata/*package_name/index`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.8
    *
    * @tags packages_nuget
    * @name GetApiV4ProjectsIdPackagesNugetMetadataPackageNamePackageVersion
    * @summary The NuGet Metadata Service - Package name and version level
    * @request GET:/api/v4/projects/{id}/packages/nuget/metadata/*package_name/*package_version
    */
    getApiV4ProjectsIdPackagesNugetMetadataPackageNamePackageVersion: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/metadata/*package_name/*package_version`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.8
    *
    * @tags packages_nuget
    * @name GetApiV4ProjectsIdPackagesNugetQuery
    * @summary The NuGet Search Service
    * @request GET:/api/v4/projects/{id}/packages/nuget/query
    */
    getApiV4ProjectsIdPackagesNugetQuery: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/query`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.8
    *
    * @tags packages_nuget
    * @name GetApiV4ProjectsIdPackagesNugetDownloadPackageNameIndex
    * @summary The NuGet Content Service - index request
    * @request GET:/api/v4/projects/{id}/packages/nuget/download/*package_name/index
    */
    getApiV4ProjectsIdPackagesNugetDownloadPackageNameIndex: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/download/*package_name/index`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.8
    *
    * @tags packages_nuget
    * @name GetApiV4ProjectsIdPackagesNugetDownloadPackageNamePackageVersionPackageFilename
    * @summary The NuGet Content Service - content request
    * @request GET:/api/v4/projects/{id}/packages/nuget/download/*package_name/*package_version/*package_filename
    */
    getApiV4ProjectsIdPackagesNugetDownloadPackageNamePackageVersionPackageFilename: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/download/*package_name/*package_version/*package_filename`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Uploads a NuGet v3 package file for a specified project.
    *
    * @tags packages_nuget
    * @name PutApiV4ProjectsIdPackagesNuget
    * @summary Upload a NuGet v3 package file for a project
    * @request PUT:/api/v4/projects/{id}/packages/nuget
    */
    putApiV4ProjectsIdPackagesNuget: (id, putApiV4ProjectsIdPackagesNuget, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesNuget,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 14.1
    *
    * @tags packages_nuget
    * @name PutApiV4ProjectsIdPackagesNugetAuthorize
    * @summary The NuGet Package Authorize endpoint
    * @request PUT:/api/v4/projects/{id}/packages/nuget/authorize
    */
    putApiV4ProjectsIdPackagesNugetAuthorize: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/authorize`,
      method: "PUT",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Uploads a specified NuGet symbol package file (`.snupkg`) for a project.
    *
    * @tags packages_nuget
    * @name PutApiV4ProjectsIdPackagesNugetSymbolpackage
    * @summary Upload a NuGet symbol package file
    * @request PUT:/api/v4/projects/{id}/packages/nuget/symbolpackage
    */
    putApiV4ProjectsIdPackagesNugetSymbolpackage: (id, putApiV4ProjectsIdPackagesNugetSymbolpackage, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/symbolpackage`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesNugetSymbolpackage,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 14.1
    *
    * @tags packages_nuget
    * @name PutApiV4ProjectsIdPackagesNugetSymbolpackageAuthorize
    * @summary The NuGet Symbol Package Authorize endpoint
    * @request PUT:/api/v4/projects/{id}/packages/nuget/symbolpackage/authorize
    */
    putApiV4ProjectsIdPackagesNugetSymbolpackageAuthorize: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/symbolpackage/authorize`,
      method: "PUT",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 16.5
    *
    * @tags packages_nuget
    * @name DeleteApiV4ProjectsIdPackagesNugetPackageNamePackageVersion
    * @summary The NuGet Package Delete endpoint
    * @request DELETE:/api/v4/projects/{id}/packages/nuget/*package_name/*package_version
    */
    deleteApiV4ProjectsIdPackagesNugetPackageNamePackageVersion: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/*package_name/*package_version`,
      method: "DELETE",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 16.2
    *
    * @tags packages_nuget
    * @name PutApiV4ProjectsIdPackagesNugetV2Authorize
    * @summary The NuGet V2 Feed Package Authorize endpoint
    * @request PUT:/api/v4/projects/{id}/packages/nuget/v2/authorize
    */
    putApiV4ProjectsIdPackagesNugetV2Authorize: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/nuget/v2/authorize`,
      method: "PUT",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 16.4
    *
    * @tags packages_nuget
    * @name GetApiV4ProjectsProjectIdPackagesNugetV2Findpackagesbyid
    * @summary The NuGet V2 Feed Find Packages by ID endpoint
    * @request GET:/api/v4/projects/{project_id}/packages/nuget/v2/FindPackagesById\(\)
    */
    getApiV4ProjectsProjectIdPackagesNugetV2Findpackagesbyid: (projectId, query, params = {}) => this.request({
      path: `/api/v4/projects/${projectId}/packages/nuget/v2/FindPackagesById\\(\\)`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 16.4
    *
    * @tags packages_nuget
    * @name GetApiV4ProjectsProjectIdPackagesNugetV2Packages
    * @summary The NuGet V2 Feed Enumerate Packages endpoint
    * @request GET:/api/v4/projects/{project_id}/packages/nuget/v2/Packages\(\)
    */
    getApiV4ProjectsProjectIdPackagesNugetV2Packages: (projectId, query, params = {}) => this.request({
      path: `/api/v4/projects/${projectId}/packages/nuget/v2/Packages\\(\\)`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 16.4
    *
    * @tags packages_nuget
    * @name GetApiV4ProjectsProjectIdPackagesNugetV2PackagesIdPackageNameVersionPackageVersion
    * @summary The NuGet V2 Feed Single Package Metadata endpoint
    * @request GET:/api/v4/projects/{project_id}/packages/nuget/v2/Packages\(Id='*package_name',Version='*package_version'\)
    */
    getApiV4ProjectsProjectIdPackagesNugetV2PackagesIdPackageNameVersionPackageVersion: (projectId, query, params = {}) => this.request({
      path: `/api/v4/projects/${projectId}/packages/nuget/v2/Packages\\(Id='*package_name',Version='*package_version'\\)`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Lists all package files for a specified package.
    *
    * @tags packages
    * @name GetApiV4ProjectsIdPackagesPackageIdPackageFiles
    * @summary List all package files
    * @request GET:/api/v4/projects/{id}/packages/{package_id}/package_files
    */
    getApiV4ProjectsIdPackagesPackageIdPackageFiles: (id, packageId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/${packageId}/package_files`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified package file.
    *
    * @tags packages
    * @name DeleteApiV4ProjectsIdPackagesPackageIdPackageFilesPackageFileId
    * @summary Delete a package file
    * @request DELETE:/api/v4/projects/{id}/packages/{package_id}/package_files/{package_file_id}
    */
    deleteApiV4ProjectsIdPackagesPackageIdPackageFilesPackageFileId: (id, packageId, packageFileId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/${packageId}/package_files/${packageFileId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 18.4
    *
    * @tags packages
    * @name GetApiV4ProjectsIdPackagesPackageIdPackageFilesPackageFileIdDownload
    * @summary Download a package file
    * @request GET:/api/v4/projects/{id}/packages/{package_id}/package_files/{package_file_id}/download
    */
    getApiV4ProjectsIdPackagesPackageIdPackageFilesPackageFileIdDownload: (id, packageId, packageFileId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/${packageId}/package_files/${packageFileId}/download`,
      method: "GET",
      ...params
    }),
    /**
    * @description Unpublishes Pages from a specified project. You must have the Maintainer or Owner role for the project.
    *
    * @tags gitlab_pages
    * @name DeleteApiV4ProjectsIdPages
    * @summary Unpublish Pages
    * @request DELETE:/api/v4/projects/{id}/pages
    */
    deleteApiV4ProjectsIdPages: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pages`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Updates Pages settings for a specified project. You must have the Maintainer or Owner role for the project.
    *
    * @tags gitlab_pages
    * @name PatchApiV4ProjectsIdPages
    * @summary Update Pages settings for a project
    * @request PATCH:/api/v4/projects/{id}/pages
    */
    patchApiV4ProjectsIdPages: (id, patchApiV4ProjectsIdPages, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pages`,
      method: "PATCH",
      body: patchApiV4ProjectsIdPages,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Retrieves Pages settings for a specified project. You must have the Maintainer or Owner role for the project.
    *
    * @tags gitlab_pages
    * @name GetApiV4ProjectsIdPages
    * @summary Retrieve Pages settings for a project
    * @request GET:/api/v4/projects/{id}/pages
    */
    getApiV4ProjectsIdPages: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pages`,
      method: "GET",
      ...params
    }),
    /**
    * @description Lists all Pages domains in a specified project. You must have permissions to view Pages domains.
    *
    * @tags gitlab_pages
    * @name GetApiV4ProjectsIdPagesDomains
    * @summary List all Pages domains in a project
    * @request GET:/api/v4/projects/{id}/pages/domains
    */
    getApiV4ProjectsIdPagesDomains: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pages/domains`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a Pages domain in a specified project. You must have permissions to create Pages domains.
    *
    * @tags gitlab_pages
    * @name PostApiV4ProjectsIdPagesDomains
    * @summary Create Pages domain
    * @request POST:/api/v4/projects/{id}/pages/domains
    */
    postApiV4ProjectsIdPagesDomains: (id, postApiV4ProjectsIdPagesDomains, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pages/domains`,
      method: "POST",
      body: postApiV4ProjectsIdPagesDomains,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a Pages domain from a specified project. You must have permissions to view Pages domains.
    *
    * @tags gitlab_pages
    * @name GetApiV4ProjectsIdPagesDomainsDomain
    * @summary Retrieve a Pages domain
    * @request GET:/api/v4/projects/{id}/pages/domains/{domain}
    */
    getApiV4ProjectsIdPagesDomainsDomain: (id, domain, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pages/domains/${domain}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified Pages domain in a project. You must have permissions to change an existing Pages domain.
    *
    * @tags gitlab_pages
    * @name PutApiV4ProjectsIdPagesDomainsDomain
    * @summary Update Pages domain
    * @request PUT:/api/v4/projects/{id}/pages/domains/{domain}
    */
    putApiV4ProjectsIdPagesDomainsDomain: (id, domain, putApiV4ProjectsIdPagesDomainsDomain, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pages/domains/${domain}`,
      method: "PUT",
      body: putApiV4ProjectsIdPagesDomainsDomain,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Deletes a specified Pages domain in a project.
    *
    * @tags gitlab_pages
    * @name DeleteApiV4ProjectsIdPagesDomainsDomain
    * @summary Delete Pages domain
    * @request DELETE:/api/v4/projects/{id}/pages/domains/{domain}
    */
    deleteApiV4ProjectsIdPagesDomainsDomain: (id, domain, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pages/domains/${domain}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Verifies a specified Pages domain in a project. You must have permissions to update Pages domains.
    *
    * @tags gitlab_pages
    * @name PutApiV4ProjectsIdPagesDomainsDomainVerify
    * @summary Verify Pages domain
    * @request PUT:/api/v4/projects/{id}/pages/domains/{domain}/verify
    */
    putApiV4ProjectsIdPagesDomainsDomainVerify: (id, domain, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pages/domains/${domain}/verify`,
      method: "PUT",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Downloads a project avatar. You can access this endpoint without authentication if the project is publicly accessible. This feature was introduced in GitLab 16.9.
    *
    * @tags avatars
    * @name GetApiV4ProjectsIdAvatar
    * @summary Download a project avatar
    * @request GET:/api/v4/projects/{id}/avatar
    */
    getApiV4ProjectsIdAvatar: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/avatar`,
      method: "GET",
      ...params
    }),
    /**
    * @description Lists all clusters in a specified project.
    *
    * @tags clusters
    * @name GetApiV4ProjectsIdClusters
    * @summary List all clusters in a project
    * @request GET:/api/v4/projects/{id}/clusters
    */
    getApiV4ProjectsIdClusters: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/clusters`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified cluster in a project.
    *
    * @tags clusters
    * @name GetApiV4ProjectsIdClustersClusterId
    * @summary Retrieve a cluster from a project
    * @request GET:/api/v4/projects/{id}/clusters/{cluster_id}
    */
    getApiV4ProjectsIdClustersClusterId: (id, clusterId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/clusters/${clusterId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a cluster in a specified project.
    *
    * @tags clusters
    * @name PutApiV4ProjectsIdClustersClusterId
    * @summary Update a cluster in a project
    * @request PUT:/api/v4/projects/{id}/clusters/{cluster_id}
    */
    putApiV4ProjectsIdClustersClusterId: (id, clusterId, putApiV4ProjectsIdClustersClusterId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/clusters/${clusterId}`,
      method: "PUT",
      body: putApiV4ProjectsIdClustersClusterId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified cluster from a project. Does not remove existing resources in the connected Kubernetes cluster.
    *
    * @tags clusters
    * @name DeleteApiV4ProjectsIdClustersClusterId
    * @summary Delete cluster from a project
    * @request DELETE:/api/v4/projects/{id}/clusters/{cluster_id}
    */
    deleteApiV4ProjectsIdClustersClusterId: (id, clusterId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/clusters/${clusterId}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description Adds a cluster to a specified project.
    *
    * @tags clusters
    * @name PostApiV4ProjectsIdClustersUser
    * @summary Add a cluster to a project
    * @request POST:/api/v4/projects/{id}/clusters/user
    */
    postApiV4ProjectsIdClustersUser: (id, postApiV4ProjectsIdClustersUser, params = {}) => this.request({
      path: `/api/v4/projects/${id}/clusters/user`,
      method: "POST",
      body: postApiV4ProjectsIdClustersUser,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all registry repositories for a specified project. Responses are paginated and return 20 results by default.
    *
    * @tags container_registry
    * @name GetApiV4ProjectsIdRegistryRepositories
    * @summary List all registry repositories for a project
    * @request GET:/api/v4/projects/{id}/registry/repositories
    */
    getApiV4ProjectsIdRegistryRepositories: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/registry/repositories`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified repository in the registry. This operation is executed asynchronously and might take some time to execute.
    *
    * @tags container_registry
    * @name DeleteApiV4ProjectsIdRegistryRepositoriesRepositoryId
    * @summary Delete registry repository
    * @request DELETE:/api/v4/projects/{id}/registry/repositories/{repository_id}
    */
    deleteApiV4ProjectsIdRegistryRepositoriesRepositoryId: (id, repositoryId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/registry/repositories/${repositoryId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all tags for a specified registry repository. Responses are paginated and return 20 results by default.
    *
    * @tags container_registry
    * @name GetApiV4ProjectsIdRegistryRepositoriesRepositoryIdTags
    * @summary List all registry repository tags for a project
    * @request GET:/api/v4/projects/{id}/registry/repositories/{repository_id}/tags
    */
    getApiV4ProjectsIdRegistryRepositoriesRepositoryIdTags: (id, repositoryId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/registry/repositories/${repositoryId}/tags`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes multiple registry repository tags based on the specified criteria.
    *
    * @tags container_registry
    * @name DeleteApiV4ProjectsIdRegistryRepositoriesRepositoryIdTags
    * @summary Delete multiple registry repository tags
    * @request DELETE:/api/v4/projects/{id}/registry/repositories/{repository_id}/tags
    */
    deleteApiV4ProjectsIdRegistryRepositoriesRepositoryIdTags: (id, repositoryId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/registry/repositories/${repositoryId}/tags`,
      method: "DELETE",
      query,
      ...params
    }),
    /**
    * @description Retrieves details of a specified registry repository tag.
    *
    * @tags container_registry
    * @name GetApiV4ProjectsIdRegistryRepositoriesRepositoryIdTagsTagName
    * @summary Retrieve details of a registry repository tag
    * @request GET:/api/v4/projects/{id}/registry/repositories/{repository_id}/tags/{tag_name}
    */
    getApiV4ProjectsIdRegistryRepositoriesRepositoryIdTagsTagName: (id, repositoryId, tagName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/registry/repositories/${repositoryId}/tags/${tagName}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified container registry repository tag.
    *
    * @tags container_registry
    * @name DeleteApiV4ProjectsIdRegistryRepositoriesRepositoryIdTagsTagName
    * @summary Delete a registry repository tag
    * @request DELETE:/api/v4/projects/{id}/registry/repositories/{repository_id}/tags/{tag_name}
    */
    deleteApiV4ProjectsIdRegistryRepositoriesRepositoryIdTagsTagName: (id, repositoryId, tagName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/registry/repositories/${repositoryId}/tags/${tagName}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all container repository protection rules for a specified project.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdRegistryProtectionRepositoryRules
    * @summary List all container repository protection rules
    * @request GET:/api/v4/projects/{id}/registry/protection/repository/rules
    */
    getApiV4ProjectsIdRegistryProtectionRepositoryRules: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/registry/protection/repository/rules`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates a container repository protection rule for a specified project to control who can push or delete container images.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdRegistryProtectionRepositoryRules
    * @summary Create a container repository protection rule
    * @request POST:/api/v4/projects/{id}/registry/protection/repository/rules
    */
    postApiV4ProjectsIdRegistryProtectionRepositoryRules: (id, postApiV4ProjectsIdRegistryProtectionRepositoryRules, params = {}) => this.request({
      path: `/api/v4/projects/${id}/registry/protection/repository/rules`,
      method: "POST",
      body: postApiV4ProjectsIdRegistryProtectionRepositoryRules,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Updates a container repository protection rule for a specified project.
    *
    * @tags projects
    * @name PatchApiV4ProjectsIdRegistryProtectionRepositoryRulesProtectionRuleId
    * @summary Update a container repository protection rule
    * @request PATCH:/api/v4/projects/{id}/registry/protection/repository/rules/{protection_rule_id}
    */
    patchApiV4ProjectsIdRegistryProtectionRepositoryRulesProtectionRuleId: (id, protectionRuleId, patchApiV4ProjectsIdRegistryProtectionRepositoryRulesProtectionRuleId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/registry/protection/repository/rules/${protectionRuleId}`,
      method: "PATCH",
      body: patchApiV4ProjectsIdRegistryProtectionRepositoryRulesProtectionRuleId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified container repository protection rule.
    *
    * @tags projects
    * @name DeleteApiV4ProjectsIdRegistryProtectionRepositoryRulesProtectionRuleId
    * @summary Delete a container repository protection rule
    * @request DELETE:/api/v4/projects/{id}/registry/protection/repository/rules/{protection_rule_id}
    */
    deleteApiV4ProjectsIdRegistryProtectionRepositoryRulesProtectionRuleId: (id, protectionRuleId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/registry/protection/repository/rules/${protectionRuleId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all container registry protection tag rules for a project. This feature was introduced in GitLab 18.7.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdRegistryProtectionTagRules
    * @summary List all container registry protection tag rules
    * @request GET:/api/v4/projects/{id}/registry/protection/tag/rules
    */
    getApiV4ProjectsIdRegistryProtectionTagRules: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/registry/protection/tag/rules`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates a container registry protection tag rule for a project to control who can push or delete container tags. This feature was introduced in GitLab 18.8.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdRegistryProtectionTagRules
    * @summary Create a container registry protection tag rule
    * @request POST:/api/v4/projects/{id}/registry/protection/tag/rules
    */
    postApiV4ProjectsIdRegistryProtectionTagRules: (id, postApiV4ProjectsIdRegistryProtectionTagRules, params = {}) => this.request({
      path: `/api/v4/projects/${id}/registry/protection/tag/rules`,
      method: "POST",
      body: postApiV4ProjectsIdRegistryProtectionTagRules,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Updates a container registry protection tag rule for a project. This feature was introduced in GitLab 18.9.
    *
    * @tags projects
    * @name PatchApiV4ProjectsIdRegistryProtectionTagRulesProtectionRuleId
    * @summary Update a container registry protection tag rule
    * @request PATCH:/api/v4/projects/{id}/registry/protection/tag/rules/{protection_rule_id}
    */
    patchApiV4ProjectsIdRegistryProtectionTagRulesProtectionRuleId: (id, protectionRuleId, patchApiV4ProjectsIdRegistryProtectionTagRulesProtectionRuleId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/registry/protection/tag/rules/${protectionRuleId}`,
      method: "PATCH",
      body: patchApiV4ProjectsIdRegistryProtectionTagRulesProtectionRuleId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a container registry protection tag rule from a project. This feature was introduced in GitLab 18.9.
    *
    * @tags projects
    * @name DeleteApiV4ProjectsIdRegistryProtectionTagRulesProtectionRuleId
    * @summary Delete a container registry protection tag rule
    * @request DELETE:/api/v4/projects/{id}/registry/protection/tag/rules/{protection_rule_id}
    */
    deleteApiV4ProjectsIdRegistryProtectionTagRulesProtectionRuleId: (id, protectionRuleId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/registry/protection/tag/rules/${protectionRuleId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Creates a Debian project distribution for a specified project.
    *
    * @tags packages_debian
    * @name PostApiV4ProjectsIdDebianDistributions
    * @summary Create a Debian project distribution
    * @request POST:/api/v4/projects/{id}/debian_distributions
    */
    postApiV4ProjectsIdDebianDistributions: (id, postApiV4ProjectsIdDebianDistributions, params = {}) => this.request({
      path: `/api/v4/projects/${id}/debian_distributions`,
      method: "POST",
      body: postApiV4ProjectsIdDebianDistributions,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all Debian distributions for a specified project.
    *
    * @tags packages_debian
    * @name GetApiV4ProjectsIdDebianDistributions
    * @summary List all Debian project distributions
    * @request GET:/api/v4/projects/{id}/debian_distributions
    */
    getApiV4ProjectsIdDebianDistributions: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/debian_distributions`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified Debian project distribution for a project.
    *
    * @tags packages_debian
    * @name GetApiV4ProjectsIdDebianDistributionsCodename
    * @summary Retrieve a Debian project distribution
    * @request GET:/api/v4/projects/{id}/debian_distributions/{codename}
    */
    getApiV4ProjectsIdDebianDistributionsCodename: (id, codename, params = {}) => this.request({
      path: `/api/v4/projects/${id}/debian_distributions/${codename}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified Debian project distribution for a project.
    *
    * @tags packages_debian
    * @name PutApiV4ProjectsIdDebianDistributionsCodename
    * @summary Update a Debian project distribution
    * @request PUT:/api/v4/projects/{id}/debian_distributions/{codename}
    */
    putApiV4ProjectsIdDebianDistributionsCodename: (id, codename, putApiV4ProjectsIdDebianDistributionsCodename, params = {}) => this.request({
      path: `/api/v4/projects/${id}/debian_distributions/${codename}`,
      method: "PUT",
      body: putApiV4ProjectsIdDebianDistributionsCodename,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified Debian project distribution for a project.
    *
    * @tags packages_debian
    * @name DeleteApiV4ProjectsIdDebianDistributionsCodename
    * @summary Delete a Debian project distribution
    * @request DELETE:/api/v4/projects/{id}/debian_distributions/{codename}
    */
    deleteApiV4ProjectsIdDebianDistributionsCodename: (id, codename, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/debian_distributions/${codename}`,
      method: "DELETE",
      query,
      ...params
    }),
    /**
    * @description Retrieves a specified Debian project distribution key for a project.
    *
    * @tags packages_debian
    * @name GetApiV4ProjectsIdDebianDistributionsCodenameKeyAsc
    * @summary Retrieve a Debian project distribution key
    * @request GET:/api/v4/projects/{id}/debian_distributions/{codename}/key.asc
    */
    getApiV4ProjectsIdDebianDistributionsCodenameKeyAsc: (id, codename, params = {}) => this.request({
      path: `/api/v4/projects/${id}/debian_distributions/${codename}/key.asc`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all visible events for a specified project. When a push exceeds the Push event activities limit, a single bulk push event is returned instead of individual commit events. Bulk push events have limited commit details: `commit_count` is `0`, `ref_count` shows the number of refs pushed, and individual commit attributes are `null`.
    *
    * @tags events
    * @name GetApiV4ProjectsIdEvents
    * @summary List all visible events for a project
    * @request GET:/api/v4/projects/{id}/events
    */
    getApiV4ProjectsIdEvents: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/events`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the status of the most recent export for a specified project.
    *
    * @tags project_import
    * @name GetApiV4ProjectsIdExport
    * @summary Retrieve the status of a project export
    * @request GET:/api/v4/projects/{id}/export
    */
    getApiV4ProjectsIdExport: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/export`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Exports a project. Use the `upload` hash parameter to upload the exported project to a web server or any S3-compatible platform.
    *
    * @tags project_import
    * @name PostApiV4ProjectsIdExport
    * @summary Export a project
    * @request POST:/api/v4/projects/{id}/export
    */
    postApiV4ProjectsIdExport: (id, postApiV4ProjectsIdExport, params = {}) => this.request({
      path: `/api/v4/projects/${id}/export`,
      method: "POST",
      body: postApiV4ProjectsIdExport,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Downloads the most recent export of a specified project.
    *
    * @tags project_import
    * @name GetApiV4ProjectsIdExportDownload
    * @summary Download a project export
    * @request GET:/api/v4/projects/{id}/export/download
    */
    getApiV4ProjectsIdExportDownload: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/export/download`,
      method: "GET",
      ...params
    }),
    /**
    * @description Schedules a relations export for a specified project.
    *
    * @tags project_import
    * @name PostApiV4ProjectsIdExportRelations
    * @summary Schedule a relations export for a project
    * @request POST:/api/v4/projects/{id}/export_relations
    */
    postApiV4ProjectsIdExportRelations: (id, postApiV4ProjectsIdExportRelations, params = {}) => this.request({
      path: `/api/v4/projects/${id}/export_relations`,
      method: "POST",
      body: postApiV4ProjectsIdExportRelations,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Downloads a project relations export file.
    *
    * @tags project_import
    * @name GetApiV4ProjectsIdExportRelationsDownload
    * @summary Download a relations export for a project
    * @request GET:/api/v4/projects/{id}/export_relations/download
    */
    getApiV4ProjectsIdExportRelationsDownload: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/export_relations/download`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Retrieves the status of a relations export for a project.
    *
    * @tags project_import
    * @name GetApiV4ProjectsIdExportRelationsStatus
    * @summary Retrieve the status of an relations export for a project
    * @request GET:/api/v4/projects/{id}/export_relations/status
    */
    getApiV4ProjectsIdExportRelationsStatus: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/export_relations/status`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Updates a URL variable for a specified webhook.
    *
    * @tags hooks
    * @name PutApiV4ProjectsIdHooksHookIdUrlVariablesKey
    * @summary Update a URL variable
    * @request PUT:/api/v4/projects/{id}/hooks/{hook_id}/url_variables/{key}
    */
    putApiV4ProjectsIdHooksHookIdUrlVariablesKey: (hookId, key, id, putApiV4ProjectsIdHooksHookIdUrlVariablesKey, params = {}) => this.request({
      path: `/api/v4/projects/${id}/hooks/${hookId}/url_variables/${key}`,
      method: "PUT",
      body: putApiV4ProjectsIdHooksHookIdUrlVariablesKey,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Deletes a URL variable from a specified webhook.
    *
    * @tags hooks
    * @name DeleteApiV4ProjectsIdHooksHookIdUrlVariablesKey
    * @summary Delete a URL variable
    * @request DELETE:/api/v4/projects/{id}/hooks/{hook_id}/url_variables/{key}
    */
    deleteApiV4ProjectsIdHooksHookIdUrlVariablesKey: (hookId, key, id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/hooks/${hookId}/url_variables/${key}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Updates a custom header for a specified webhook.
    *
    * @tags hooks
    * @name PutApiV4ProjectsIdHooksHookIdCustomHeadersKey
    * @summary Update a custom header
    * @request PUT:/api/v4/projects/{id}/hooks/{hook_id}/custom_headers/{key}
    */
    putApiV4ProjectsIdHooksHookIdCustomHeadersKey: (hookId, key, id, putApiV4ProjectsIdHooksHookIdCustomHeadersKey, params = {}) => this.request({
      path: `/api/v4/projects/${id}/hooks/${hookId}/custom_headers/${key}`,
      method: "PUT",
      body: putApiV4ProjectsIdHooksHookIdCustomHeadersKey,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Deletes a custom header from a specified webhook.
    *
    * @tags hooks
    * @name DeleteApiV4ProjectsIdHooksHookIdCustomHeadersKey
    * @summary Delete a custom header
    * @request DELETE:/api/v4/projects/{id}/hooks/{hook_id}/custom_headers/{key}
    */
    deleteApiV4ProjectsIdHooksHookIdCustomHeadersKey: (hookId, key, id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/hooks/${hookId}/custom_headers/${key}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all webhooks for a specified project.
    *
    * @tags hooks
    * @name GetApiV4ProjectsIdHooks
    * @summary List all webhooks for a project
    * @request GET:/api/v4/projects/{id}/hooks
    */
    getApiV4ProjectsIdHooks: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/hooks`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds a webhook to a specified project.
    *
    * @tags hooks
    * @name PostApiV4ProjectsIdHooks
    * @summary Add a webhook to a project
    * @request POST:/api/v4/projects/{id}/hooks
    */
    postApiV4ProjectsIdHooks: (id, postApiV4ProjectsIdHooks, params = {}) => this.request({
      path: `/api/v4/projects/${id}/hooks`,
      method: "POST",
      body: postApiV4ProjectsIdHooks,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified webhook for a project.
    *
    * @tags hooks
    * @name GetApiV4ProjectsIdHooksHookId
    * @summary Retrieve a project webhook
    * @request GET:/api/v4/projects/{id}/hooks/{hook_id}
    */
    getApiV4ProjectsIdHooksHookId: (id, hookId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/hooks/${hookId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified webhook for a project.
    *
    * @tags hooks
    * @name PutApiV4ProjectsIdHooksHookId
    * @summary Update a project webhook
    * @request PUT:/api/v4/projects/{id}/hooks/{hook_id}
    */
    putApiV4ProjectsIdHooksHookId: (id, hookId, putApiV4ProjectsIdHooksHookId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/hooks/${hookId}`,
      method: "PUT",
      body: putApiV4ProjectsIdHooksHookId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified webhook for a project.
    *
    * @tags hooks
    * @name DeleteApiV4ProjectsIdHooksHookId
    * @summary Delete a project webhook
    * @request DELETE:/api/v4/projects/{id}/hooks/{hook_id}
    */
    deleteApiV4ProjectsIdHooksHookId: (id, hookId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/hooks/${hookId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all events for a specified webhook.
    *
    * @tags hooks
    * @name GetApiV4ProjectsIdHooksHookIdEvents
    * @summary List all events
    * @request GET:/api/v4/projects/{id}/hooks/{hook_id}/events
    */
    getApiV4ProjectsIdHooksHookIdEvents: (id, hookId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/hooks/${hookId}/events`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Triggers a test webhook. This endpoint has a rate limit of five requests per minute for each authenticated user for a given project or group. On GitLab Self-Managed and GitLab Dedicated, an administrator can change this limit in the application settings.
    *
    * @tags hooks
    * @name PostApiV4ProjectsIdHooksHookIdTestTrigger
    * @summary Trigger a test webhook
    * @request POST:/api/v4/projects/{id}/hooks/{hook_id}/test/{trigger}
    */
    postApiV4ProjectsIdHooksHookIdTestTrigger: (hookId, trigger, id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/hooks/${hookId}/test/${trigger}`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Resends a webhook event. This endpoint has a rate limit of five requests per minute for each authenticated user for a given project or group. On GitLab Self-Managed and GitLab Dedicated, an administrator can change this limit in the application settings.
    *
    * @tags hooks
    * @name PostApiV4ProjectsIdHooksHookIdEventsHookLogIdResend
    * @summary Resend a webhook event
    * @request POST:/api/v4/projects/{id}/hooks/{hook_id}/events/{hook_log_id}/resend
    */
    postApiV4ProjectsIdHooksHookIdEventsHookLogIdResend: (hookId, hookLogId, id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/hooks/${hookId}/events/${hookLogId}/resend`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.9
    *
    * @tags project_import
    * @name PostApiV4ProjectsImportAuthorize
    * @summary Workhorse authorize the project import upload
    * @request POST:/api/v4/projects/import/authorize
    */
    postApiV4ProjectsImportAuthorize: (params = {}) => this.request({
      path: `/api/v4/projects/import/authorize`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Imports a project from a local archive.
    *
    * @tags project_import
    * @name PostApiV4ProjectsImport
    * @summary Import a project from a local archive
    * @request POST:/api/v4/projects/import
    */
    postApiV4ProjectsImport: (data, params = {}) => this.request({
      path: `/api/v4/projects/import`,
      method: "POST",
      body: data,
      type: "multipart/form-data" /* FormData */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the status of the most recent import for a specified project.
    *
    * @tags project_import
    * @name GetApiV4ProjectsIdImport
    * @summary Retrieve the status of a project import
    * @request GET:/api/v4/projects/{id}/import
    */
    getApiV4ProjectsIdImport: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/import`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Imports a project from a specified Git URL. This feature was introduced in GitLab 18.10.
    *
    * @tags project_import
    * @name PostApiV4ProjectsIdImportGit
    * @summary Import a project from a Git URL
    * @request POST:/api/v4/projects/{id}/import/git
    */
    postApiV4ProjectsIdImportGit: (id, postApiV4ProjectsIdImportGit, params = {}) => this.request({
      path: `/api/v4/projects/${id}/import/git`,
      method: "POST",
      body: postApiV4ProjectsIdImportGit,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Imports a project from a remote archive.
    *
    * @tags project_import
    * @name PostApiV4ProjectsRemoteImport
    * @summary Import a project from a remote archive
    * @request POST:/api/v4/projects/remote-import
    */
    postApiV4ProjectsRemoteImport: (data, params = {}) => this.request({
      path: `/api/v4/projects/remote-import`,
      method: "POST",
      body: data,
      type: "multipart/form-data" /* FormData */,
      format: "json",
      ...params
    }),
    /**
    * @description Authorizes uploading a project relation import file. This feature was introduced in GitLab 16.11.
    *
    * @tags project_import
    * @name PostApiV4ProjectsImportRelationAuthorize
    * @summary Authorize project relation import
    * @request POST:/api/v4/projects/import-relation/authorize
    */
    postApiV4ProjectsImportRelationAuthorize: (params = {}) => this.request({
      path: `/api/v4/projects/import-relation/authorize`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Imports project resources included with a project archive. The type of item to import is controlled by the `relation` attribute. Skips items that were previously imported. This feature was introduced in GitLab 16.11.
    *
    * @tags project_import
    * @name PostApiV4ProjectsImportRelation
    * @summary Import project resources
    * @request POST:/api/v4/projects/import-relation
    */
    postApiV4ProjectsImportRelation: (data, params = {}) => this.request({
      path: `/api/v4/projects/import-relation`,
      method: "POST",
      body: data,
      type: "multipart/form-data" /* FormData */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the status of the most recent relation import for a specified project. Because only one relation import can be scheduled at a time, you can use this endpoint to check whether the previous import completed successfully. This feature was introduced in GitLab 16.11.
    *
    * @tags project_import
    * @name GetApiV4ProjectsIdRelationImports
    * @summary Retrieve the status of a project resource import
    * @request GET:/api/v4/projects/{id}/relation-imports
    */
    getApiV4ProjectsIdRelationImports: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/relation-imports`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Imports a project from an archive stored in a specified AWS S3 bucket.
    *
    * @tags project_import
    * @name PostApiV4ProjectsRemoteImportS3
    * @summary Import a project from an AWS S3 bucket
    * @request POST:/api/v4/projects/remote-import-s3
    */
    postApiV4ProjectsRemoteImportS3: (data, params = {}) => this.request({
      path: `/api/v4/projects/remote-import-s3`,
      method: "POST",
      body: data,
      type: "multipart/form-data" /* FormData */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the CI/CD job token access settings (job token scope) of a specified project.
    *
    * @tags projects_job_token_scope
    * @name GetApiV4ProjectsIdJobTokenScope
    * @summary Retrieve the CI/CD job token access settings for a project
    * @request GET:/api/v4/projects/{id}/job_token_scope
    */
    getApiV4ProjectsIdJobTokenScope: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/job_token_scope`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates the **Authorized groups and projects** setting (job token scope) of a specified project.
    *
    * @tags projects_job_token_scope
    * @name PatchApiV4ProjectsIdJobTokenScope
    * @summary Update the CI/CD job token access settings for a project
    * @request PATCH:/api/v4/projects/{id}/job_token_scope
    */
    patchApiV4ProjectsIdJobTokenScope: (id, patchApiV4ProjectsIdJobTokenScope, params = {}) => this.request({
      path: `/api/v4/projects/${id}/job_token_scope`,
      method: "PATCH",
      body: patchApiV4ProjectsIdJobTokenScope,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all projects in the CI/CD job token allowlist of a specified project.
    *
    * @tags projects_job_token_scope
    * @name GetApiV4ProjectsIdJobTokenScopeAllowlist
    * @summary List all projects in a CI/CD job token allowlist
    * @request GET:/api/v4/projects/{id}/job_token_scope/allowlist
    */
    getApiV4ProjectsIdJobTokenScopeAllowlist: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/job_token_scope/allowlist`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds a project to the CI/CD job token allowlist of a specified project.
    *
    * @tags projects_job_token_scope
    * @name PostApiV4ProjectsIdJobTokenScopeAllowlist
    * @summary Add a project to a CI/CD job token allowlist
    * @request POST:/api/v4/projects/{id}/job_token_scope/allowlist
    */
    postApiV4ProjectsIdJobTokenScopeAllowlist: (id, postApiV4ProjectsIdJobTokenScopeAllowlist, params = {}) => this.request({
      path: `/api/v4/projects/${id}/job_token_scope/allowlist`,
      method: "POST",
      body: postApiV4ProjectsIdJobTokenScopeAllowlist,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all groups in the CI/CD job token allowlist of a specified project.
    *
    * @tags projects_job_token_scope
    * @name GetApiV4ProjectsIdJobTokenScopeGroupsAllowlist
    * @summary List all groups in a CI/CD job token allowlist
    * @request GET:/api/v4/projects/{id}/job_token_scope/groups_allowlist
    */
    getApiV4ProjectsIdJobTokenScopeGroupsAllowlist: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/job_token_scope/groups_allowlist`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds a group to the CI/CD job token allowlist of a specified project.
    *
    * @tags projects_job_token_scope
    * @name PostApiV4ProjectsIdJobTokenScopeGroupsAllowlist
    * @summary Add a group to a CI/CD job token allowlist
    * @request POST:/api/v4/projects/{id}/job_token_scope/groups_allowlist
    */
    postApiV4ProjectsIdJobTokenScopeGroupsAllowlist: (id, postApiV4ProjectsIdJobTokenScopeGroupsAllowlist, params = {}) => this.request({
      path: `/api/v4/projects/${id}/job_token_scope/groups_allowlist`,
      method: "POST",
      body: postApiV4ProjectsIdJobTokenScopeGroupsAllowlist,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a group from the CI/CD job token allowlist of a specified project.
    *
    * @tags projects_job_token_scope
    * @name DeleteApiV4ProjectsIdJobTokenScopeGroupsAllowlistTargetGroupId
    * @summary Delete a group from a CI/CD job token allowlist
    * @request DELETE:/api/v4/projects/{id}/job_token_scope/groups_allowlist/{target_group_id}
    */
    deleteApiV4ProjectsIdJobTokenScopeGroupsAllowlistTargetGroupId: (id, targetGroupId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/job_token_scope/groups_allowlist/${targetGroupId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Deletes a project from the CI/CD job token allowlist of a specified project.
    *
    * @tags projects_job_token_scope
    * @name DeleteApiV4ProjectsIdJobTokenScopeAllowlistTargetProjectId
    * @summary Delete a project from a CI/CD job token allowlist
    * @request DELETE:/api/v4/projects/{id}/job_token_scope/allowlist/{target_project_id}
    */
    deleteApiV4ProjectsIdJobTokenScopeAllowlistTargetProjectId: (id, targetProjectId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/job_token_scope/allowlist/${targetProjectId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all packages for a specified project. All package types are included in results. Unauthenticated requests return only packages of public projects. By default, packages with `default`, `deprecated`, and `error` status are returned. Use the `status` parameter to view other packages.
    *
    * @tags packages
    * @name GetApiV4ProjectsIdPackages
    * @summary List all packages for a project
    * @request GET:/api/v4/projects/{id}/packages
    */
    getApiV4ProjectsIdPackages: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified project package. Only packages with status `default` or `deprecated` are returned.
    *
    * @tags packages
    * @name GetApiV4ProjectsIdPackagesPackageId
    * @summary Retrieve a project package
    * @request GET:/api/v4/projects/{id}/packages/{package_id}
    */
    getApiV4ProjectsIdPackagesPackageId: (id, packageId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/${packageId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified project package.
    *
    * @tags packages
    * @name DeleteApiV4ProjectsIdPackagesPackageId
    * @summary Delete a project package
    * @request DELETE:/api/v4/projects/{id}/packages/{package_id}
    */
    deleteApiV4ProjectsIdPackagesPackageId: (id, packageId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/${packageId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all pipelines for a specified package. The results are sorted by `id` in descending order. The results are paginated and return up to 20 records per page. This feature was introduced in GitLab 16.1.
    *
    * @tags packages
    * @name GetApiV4ProjectsIdPackagesPackageIdPipelines
    * @summary List all package pipelines
    * @request GET:/api/v4/projects/{id}/packages/{package_id}/pipelines
    */
    getApiV4ProjectsIdPackagesPackageIdPipelines: (id, packageId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/${packageId}/pipelines`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all package protection rules for a specified project.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdPackagesProtectionRules
    * @summary List all package protection rules
    * @request GET:/api/v4/projects/{id}/packages/protection/rules
    */
    getApiV4ProjectsIdPackagesProtectionRules: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/protection/rules`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates a package protection rule for a specified project.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdPackagesProtectionRules
    * @summary Create a package protection rule
    * @request POST:/api/v4/projects/{id}/packages/protection/rules
    */
    postApiV4ProjectsIdPackagesProtectionRules: (id, postApiV4ProjectsIdPackagesProtectionRules, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/protection/rules`,
      method: "POST",
      body: postApiV4ProjectsIdPackagesProtectionRules,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Updates a package protection rule for a specified project.
    *
    * @tags projects
    * @name PatchApiV4ProjectsIdPackagesProtectionRulesPackageProtectionRuleId
    * @summary Update a package protection rule
    * @request PATCH:/api/v4/projects/{id}/packages/protection/rules/{package_protection_rule_id}
    */
    patchApiV4ProjectsIdPackagesProtectionRulesPackageProtectionRuleId: (id, packageProtectionRuleId, patchApiV4ProjectsIdPackagesProtectionRulesPackageProtectionRuleId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/protection/rules/${packageProtectionRuleId}`,
      method: "PATCH",
      body: patchApiV4ProjectsIdPackagesProtectionRulesPackageProtectionRuleId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a package protection rule from a specified project.
    *
    * @tags projects
    * @name DeleteApiV4ProjectsIdPackagesProtectionRulesPackageProtectionRuleId
    * @summary Delete a package protection rule
    * @request DELETE:/api/v4/projects/{id}/packages/protection/rules/{package_protection_rule_id}
    */
    deleteApiV4ProjectsIdPackagesProtectionRulesPackageProtectionRuleId: (id, packageProtectionRuleId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/protection/rules/${packageProtectionRuleId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Downloads snapshot of a Git repository.
    *
    * @tags project_snapshots
    * @name GetApiV4ProjectsIdSnapshot
    * @summary Download snapshot of a Git repository
    * @request GET:/api/v4/projects/{id}/snapshot
    */
    getApiV4ProjectsIdSnapshot: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snapshot`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Lists all snippets for a specified project.
    *
    * @tags snippets
    * @name GetApiV4ProjectsIdSnippets
    * @summary List all snippets for a project
    * @request GET:/api/v4/projects/{id}/snippets
    */
    getApiV4ProjectsIdSnippets: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a project snippet. The user must have permission to create snippets.
    *
    * @tags snippets
    * @name PostApiV4ProjectsIdSnippets
    * @summary Create a project snippet
    * @request POST:/api/v4/projects/{id}/snippets
    */
    postApiV4ProjectsIdSnippets: (id, postApiV4ProjectsIdSnippets, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets`,
      method: "POST",
      body: postApiV4ProjectsIdSnippets,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified project snippet.
    *
    * @tags snippets
    * @name GetApiV4ProjectsIdSnippetsSnippetId
    * @summary Retrieve a project snippet
    * @request GET:/api/v4/projects/{id}/snippets/{snippet_id}
    */
    getApiV4ProjectsIdSnippetsSnippetId: (id, snippetId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets/${snippetId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified project snippet. The user must have permission to modify snippets. Updates to snippets with multiple files must use the `files` attribute.
    *
    * @tags snippets
    * @name PutApiV4ProjectsIdSnippetsSnippetId
    * @summary Update a project snippet
    * @request PUT:/api/v4/projects/{id}/snippets/{snippet_id}
    */
    putApiV4ProjectsIdSnippetsSnippetId: (id, snippetId, putApiV4ProjectsIdSnippetsSnippetId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets/${snippetId}`,
      method: "PUT",
      body: putApiV4ProjectsIdSnippetsSnippetId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified project snippet.
    *
    * @tags snippets
    * @name DeleteApiV4ProjectsIdSnippetsSnippetId
    * @summary Delete a project snippet
    * @request DELETE:/api/v4/projects/{id}/snippets/{snippet_id}
    */
    deleteApiV4ProjectsIdSnippetsSnippetId: (id, snippetId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets/${snippetId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Retrieves the raw contents of a specified project snippet as plain text
    *
    * @tags snippets
    * @name GetApiV4ProjectsIdSnippetsSnippetIdRaw
    * @summary Retrieve a raw project snippet
    * @request GET:/api/v4/projects/{id}/snippets/{snippet_id}/raw
    */
    getApiV4ProjectsIdSnippetsSnippetIdRaw: (id, snippetId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets/${snippetId}/raw`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the raw file content from a snippet repository as plain text.
    *
    * @tags snippets
    * @name GetApiV4ProjectsIdSnippetsSnippetIdFilesRefFilePathRaw
    * @summary Retrieve snippet repository file content
    * @request GET:/api/v4/projects/{id}/snippets/{snippet_id}/files/{ref}/{file_path}/raw
    */
    getApiV4ProjectsIdSnippetsSnippetIdFilesRefFilePathRaw: (id, ref, filePath, snippetId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets/${snippetId}/files/${ref}/${filePath}/raw`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves user agent details for a specified snippet. Available only for administrators.
    *
    * @tags snippets
    * @name GetApiV4ProjectsIdSnippetsSnippetIdUserAgentDetail
    * @summary Retrieve user agent details for a project snippet
    * @request GET:/api/v4/projects/{id}/snippets/{snippet_id}/user_agent_detail
    */
    getApiV4ProjectsIdSnippetsSnippetIdUserAgentDetail: (id, snippetId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/snippets/${snippetId}/user_agent_detail`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the clone and pull statistics for the last 30 days from a specified project.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdStatistics
    * @summary Retrieve the statistics of the last 30 days
    * @request GET:/api/v4/projects/{id}/statistics
    */
    getApiV4ProjectsIdStatistics: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/statistics`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all templates of a specified type for a project.
    *
    * @tags project_templates
    * @name GetApiV4ProjectsIdTemplatesType
    * @summary List all templates of a particular type
    * @request GET:/api/v4/projects/{id}/templates/{type}
    */
    getApiV4ProjectsIdTemplatesType: (id, type, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/templates/${type}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a template of a specified type for a project.
    *
    * @tags project_templates
    * @name GetApiV4ProjectsIdTemplatesTypeName
    * @summary Retrieve a template of a particular type
    * @request GET:/api/v4/projects/{id}/templates/{type}/{name}
    */
    getApiV4ProjectsIdTemplatesTypeName: (id, type, name, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/templates/${type}/${name}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all custom attributes for a specified project.
    *
    * @tags custom_attributes
    * @name GetApiV4ProjectsIdCustomAttributes
    * @summary List all custom attributes for a project
    * @request GET:/api/v4/projects/{id}/custom_attributes
    */
    getApiV4ProjectsIdCustomAttributes: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/custom_attributes`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified custom attribute for a project.
    *
    * @tags custom_attributes
    * @name GetApiV4ProjectsIdCustomAttributesKey
    * @summary Retrieve a custom attribute for a project
    * @request GET:/api/v4/projects/{id}/custom_attributes/{key}
    */
    getApiV4ProjectsIdCustomAttributesKey: (key, id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/custom_attributes/${key}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates a custom attribute for a specified project. If the attribute already exists, it is updated, otherwise a new attribute is created.
    *
    * @tags custom_attributes
    * @name PutApiV4ProjectsIdCustomAttributesKey
    * @summary Creates or updates a custom attribute for a project
    * @request PUT:/api/v4/projects/{id}/custom_attributes/{key}
    */
    putApiV4ProjectsIdCustomAttributesKey: (key, id, putApiV4ProjectsIdCustomAttributesKey, params = {}) => this.request({
      path: `/api/v4/projects/${id}/custom_attributes/${key}`,
      method: "PUT",
      body: putApiV4ProjectsIdCustomAttributesKey,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified custom attribute for a project.
    *
    * @tags custom_attributes
    * @name DeleteApiV4ProjectsIdCustomAttributesKey
    * @summary Delete a custom attribute for a project
    * @request DELETE:/api/v4/projects/{id}/custom_attributes/{key}
    */
    deleteApiV4ProjectsIdCustomAttributesKey: (key, id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/custom_attributes/${key}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Restores a specified project that was marked for deletion.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdRestore
    * @summary Restore a project marked for deletion
    * @request POST:/api/v4/projects/{id}/restore
    */
    postApiV4ProjectsIdRestore: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/restore`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all projects. Unauthenticated requests return only public projects with a limited subset of attributes. You can filter responses by custom attributes.
    *
    * @tags projects
    * @name GetApiV4Projects
    * @summary List all projects
    * @request GET:/api/v4/projects
    */
    getApiV4Projects: (query, params = {}) => this.request({
      path: `/api/v4/projects`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a project owned by the authenticated user. If your HTTP repository is not publicly accessible, add authentication information to the URL `https://username:password@gitlab.company.com/group/project.git`, where `password` is a public access key with the `api` scope.
    *
    * @tags projects
    * @name PostApiV4Projects
    * @summary Create a project
    * @request POST:/api/v4/projects
    */
    postApiV4Projects: (postApiV4Projects, params = {}) => this.request({
      path: `/api/v4/projects`,
      method: "POST",
      body: postApiV4Projects,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a project for a user. Administrators only.
    *
    * @tags projects
    * @name PostApiV4ProjectsUserUserId
    * @summary Create a project for a user
    * @request POST:/api/v4/projects/user/{user_id}
    */
    postApiV4ProjectsUserUserId: (userId, postApiV4ProjectsUserUserId, params = {}) => this.request({
      path: `/api/v4/projects/user/${userId}`,
      method: "POST",
      body: postApiV4ProjectsUserUserId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all groups that can be invited to a project.
    *
    * @tags projects, groups
    * @name GetApiV4ProjectsIdShareLocations
    * @summary List all groups available to invite to a project
    * @request GET:/api/v4/projects/{id}/share_locations
    */
    getApiV4ProjectsIdShareLocations: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/share_locations`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves details on a specified project. This endpoint can be accessed without authentication if the project is publicly accessible.
    *
    * @tags projects
    * @name GetApiV4ProjectsId
    * @summary Retrieve a project
    * @request GET:/api/v4/projects/{id}
    */
    getApiV4ProjectsId: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Updates an existing project. If your HTTP repository is not publicly accessible, add authentication information to the URL `https://username:password@gitlab.company.com/group/project.git`, where `password` is a public access key with the `api` scope.
    *
    * @tags projects
    * @name PutApiV4ProjectsId
    * @summary Update a project
    * @request PUT:/api/v4/projects/{id}
    */
    putApiV4ProjectsId: (id, putApiV4ProjectsId, params = {}) => this.request({
      path: `/api/v4/projects/${id}`,
      method: "PUT",
      body: putApiV4ProjectsId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified project.
    *
    * @tags projects
    * @name DeleteApiV4ProjectsId
    * @summary Delete a project
    * @request DELETE:/api/v4/projects/{id}
    */
    deleteApiV4ProjectsId: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Creates a fork of a project.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdFork
    * @summary Create a fork of a project
    * @request POST:/api/v4/projects/{id}/fork
    */
    postApiV4ProjectsIdFork: (id, postApiV4ProjectsIdFork, params = {}) => this.request({
      path: `/api/v4/projects/${id}/fork`,
      method: "POST",
      body: postApiV4ProjectsIdFork,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a fork relationship between projects.
    *
    * @tags projects
    * @name DeleteApiV4ProjectsIdFork
    * @summary Delete a fork relationship
    * @request DELETE:/api/v4/projects/{id}/fork
    */
    deleteApiV4ProjectsIdFork: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/fork`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all forks of a project.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdForks
    * @summary List all forks of a project
    * @request GET:/api/v4/projects/{id}/forks
    */
    getApiV4ProjectsIdForks: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/forks`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Check pages access of this project
    *
    * @tags projects
    * @name GetApiV4ProjectsIdPagesAccess
    * @request GET:/api/v4/projects/{id}/pages_access
    */
    getApiV4ProjectsIdPagesAccess: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/pages_access`,
      method: "GET",
      ...params
    }),
    /**
    * @description Archives a specified project. You must be an administrator or be assigned the Owner role on the project.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdArchive
    * @summary Archive a project
    * @request POST:/api/v4/projects/{id}/archive
    */
    postApiV4ProjectsIdArchive: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/archive`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Unarchives a specified project. You must be an administrator or have the Owner role on the project.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdUnarchive
    * @summary Unarchive a project
    * @request POST:/api/v4/projects/{id}/unarchive
    */
    postApiV4ProjectsIdUnarchive: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/unarchive`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Stars a specified project.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdStar
    * @summary Star a project
    * @request POST:/api/v4/projects/{id}/star
    */
    postApiV4ProjectsIdStar: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/star`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Unstars a specified project.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdUnstar
    * @summary Unstar a project
    * @request POST:/api/v4/projects/{id}/unstar
    */
    postApiV4ProjectsIdUnstar: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/unstar`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all users who starred a specified project.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdStarrers
    * @summary List all users who starred a project
    * @request GET:/api/v4/projects/{id}/starrers
    */
    getApiV4ProjectsIdStarrers: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/starrers`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves information about all programming languages used in a specified project.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdLanguages
    * @summary Retrieve programming language usage information
    * @request GET:/api/v4/projects/{id}/languages
    */
    getApiV4ProjectsIdLanguages: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/languages`,
      method: "GET",
      ...params
    }),
    /**
    * @description Creates a fork relationship between a project and an upstream project.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdForkForkedFromId
    * @summary Create a fork relationship
    * @request POST:/api/v4/projects/{id}/fork/{forked_from_id}
    */
    postApiV4ProjectsIdForkForkedFromId: (id, forkedFromId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/fork/${forkedFromId}`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Shares a specified project with a group.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdShare
    * @summary Share a project with a group
    * @request POST:/api/v4/projects/{id}/share
    */
    postApiV4ProjectsIdShare: (id, postApiV4ProjectsIdShare, params = {}) => this.request({
      path: `/api/v4/projects/${id}/share`,
      method: "POST",
      body: postApiV4ProjectsIdShare,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a shared project link in a group.
    *
    * @tags projects
    * @name DeleteApiV4ProjectsIdShareGroupId
    * @summary Delete a shared project link in a group
    * @request DELETE:/api/v4/projects/{id}/share/{group_id}
    */
    deleteApiV4ProjectsIdShareGroupId: (id, groupId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/share/${groupId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Imports members from another project. If the role of the importing member for the target project is a Maintainer, then members with the Owner role for the source project are imported with the Maintainer role. If the importing member is an Owner, then members with the Owner role for the source project are imported with the Owner role.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdImportProjectMembersProjectId
    * @summary Import members
    * @request POST:/api/v4/projects/{id}/import_project_members/{project_id}
    */
    postApiV4ProjectsIdImportProjectMembersProjectId: (id, projectId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/import_project_members/${projectId}`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all members with access to a specified project.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdUsers
    * @summary List all members of a project
    * @request GET:/api/v4/projects/{id}/users
    */
    getApiV4ProjectsIdUsers: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/users`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all ancestor groups for a specified project.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdGroups
    * @summary List all ancestor groups
    * @request GET:/api/v4/projects/{id}/groups
    */
    getApiV4ProjectsIdGroups: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/groups`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all invited groups in a project. Unauthenticated requests return only public invited groups. Limited to 60 requests a minute per user account for authenticated requires and per IP address for unauthenticated requests. Supports offset-based pagination (up to 50,000 projects) and keyset-based pagination (greater than 50,000 projects).
    *
    * @tags projects
    * @name GetApiV4ProjectsIdInvitedGroups
    * @summary List all invited groups in a project
    * @request GET:/api/v4/projects/{id}/invited_groups
    */
    getApiV4ProjectsIdInvitedGroups: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/invited_groups`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Starts the housekeeping task for a project.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdHousekeeping
    * @summary Start the housekeeping task for a project
    * @request POST:/api/v4/projects/{id}/housekeeping
    */
    postApiV4ProjectsIdHousekeeping: (id, postApiV4ProjectsIdHousekeeping, params = {}) => this.request({
      path: `/api/v4/projects/${id}/housekeeping`,
      method: "POST",
      body: postApiV4ProjectsIdHousekeeping,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.0.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdRepositorySize
    * @summary Start a task to recalculate repository size for a project
    * @request POST:/api/v4/projects/{id}/repository_size
    */
    postApiV4ProjectsIdRepositorySize: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository_size`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Transfers a project to another namespace.
    *
    * @tags projects
    * @name PutApiV4ProjectsIdTransfer
    * @summary Transfer a project to another namespace
    * @request PUT:/api/v4/projects/{id}/transfer
    */
    putApiV4ProjectsIdTransfer: (id, putApiV4ProjectsIdTransfer, params = {}) => this.request({
      path: `/api/v4/projects/${id}/transfer`,
      method: "PUT",
      body: putApiV4ProjectsIdTransfer,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all namespaces where a specified project can be transferred.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdTransferLocations
    * @summary List all transferable namespaces for a project
    * @request GET:/api/v4/projects/{id}/transfer_locations
    */
    getApiV4ProjectsIdTransferLocations: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/transfer_locations`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the path to repository storage for a specified project. If you are using Gitaly Cluster (Praefect), see Praefect-generated replica paths instead. Administrators only.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdStorage
    * @summary Retrieve the path to repository storage
    * @request GET:/api/v4/projects/{id}/storage
    */
    getApiV4ProjectsIdStorage: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/storage`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all audit events for a specified project.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdAuditEvents
    * @summary List all project audit events
    * @request GET:/api/v4/projects/{id}/audit_events
    */
    getApiV4ProjectsIdAuditEvents: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/audit_events`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves an audit event for a specified project. Only available to users with at least the Developer role for the project.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdAuditEventsAuditEventId
    * @summary Retrieve a project audit event
    * @request GET:/api/v4/projects/{id}/audit_events/{audit_event_id}
    */
    getApiV4ProjectsIdAuditEventsAuditEventId: (auditEventId, id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/audit_events/${auditEventId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all protected branches for a specified project.
    *
    * @tags protected_branches
    * @name GetApiV4ProjectsIdProtectedBranches
    * @summary List all protected branches
    * @request GET:/api/v4/projects/{id}/protected_branches
    */
    getApiV4ProjectsIdProtectedBranches: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/protected_branches`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Protects a specified repository branch or several project repository branches using a wildcard protected branch.
    *
    * @tags protected_branches
    * @name PostApiV4ProjectsIdProtectedBranches
    * @summary Protect repository branches
    * @request POST:/api/v4/projects/{id}/protected_branches
    */
    postApiV4ProjectsIdProtectedBranches: (id, postApiV4ProjectsIdProtectedBranches, params = {}) => this.request({
      path: `/api/v4/projects/${id}/protected_branches`,
      method: "POST",
      body: postApiV4ProjectsIdProtectedBranches,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified protected branch or wildcard protected branch.
    *
    * @tags protected_branches
    * @name GetApiV4ProjectsIdProtectedBranchesName
    * @summary Retrieve a protected branch or wildcard protected branch
    * @request GET:/api/v4/projects/{id}/protected_branches/{name}
    */
    getApiV4ProjectsIdProtectedBranchesName: (id, name, params = {}) => this.request({
      path: `/api/v4/projects/${id}/protected_branches/${name}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a protected branch for a specified project.
    *
    * @tags protected_branches
    * @name PatchApiV4ProjectsIdProtectedBranchesName
    * @summary Update a protected branch
    * @request PATCH:/api/v4/projects/{id}/protected_branches/{name}
    */
    patchApiV4ProjectsIdProtectedBranchesName: (id, name, patchApiV4ProjectsIdProtectedBranchesName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/protected_branches/${name}`,
      method: "PATCH",
      body: patchApiV4ProjectsIdProtectedBranchesName,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Unprotects a specified protected branch or wildcard protected branch.
    *
    * @tags protected_branches
    * @name DeleteApiV4ProjectsIdProtectedBranchesName
    * @summary Unprotect repository branches
    * @request DELETE:/api/v4/projects/{id}/protected_branches/{name}
    */
    deleteApiV4ProjectsIdProtectedBranchesName: (id, name, params = {}) => this.request({
      path: `/api/v4/projects/${id}/protected_branches/${name}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all protected tags for a specified project.
    *
    * @tags protected_tags
    * @name GetApiV4ProjectsIdProtectedTags
    * @summary List all protected tags
    * @request GET:/api/v4/projects/{id}/protected_tags
    */
    getApiV4ProjectsIdProtectedTags: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/protected_tags`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Protects a specified repository tag using a wildcard protected tag.
    *
    * @tags protected_tags
    * @name PostApiV4ProjectsIdProtectedTags
    * @summary Protect a repository tag
    * @request POST:/api/v4/projects/{id}/protected_tags
    */
    postApiV4ProjectsIdProtectedTags: (id, postApiV4ProjectsIdProtectedTags, params = {}) => this.request({
      path: `/api/v4/projects/${id}/protected_tags`,
      method: "POST",
      body: postApiV4ProjectsIdProtectedTags,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified protected tag or wildcard protected tag.
    *
    * @tags protected_tags
    * @name GetApiV4ProjectsIdProtectedTagsName
    * @summary Retrieve a protected tag or wildcard protected tag
    * @request GET:/api/v4/projects/{id}/protected_tags/{name}
    */
    getApiV4ProjectsIdProtectedTagsName: (id, name, params = {}) => this.request({
      path: `/api/v4/projects/${id}/protected_tags/${name}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Unprotects a specified protected tag or wildcard protected tag.
    *
    * @tags protected_tags
    * @name DeleteApiV4ProjectsIdProtectedTagsName
    * @summary Unprotect repository tags
    * @request DELETE:/api/v4/projects/{id}/protected_tags/{name}
    */
    deleteApiV4ProjectsIdProtectedTagsName: (id, name, params = {}) => this.request({
      path: `/api/v4/projects/${id}/protected_tags/${name}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.10
    *
    * @tags packages_pypi
    * @name GetApiV4ProjectsIdPackagesPypiFilesSha256FileIdentifier
    * @summary The PyPi package download endpoint
    * @request GET:/api/v4/projects/{id}/packages/pypi/files/{sha256}/*file_identifier
    */
    getApiV4ProjectsIdPackagesPypiFilesSha256FileIdentifier: (id, sha256, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/pypi/files/${sha256}/*file_identifier`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Enforces the Dependency Firewall then redirects to the upstream artifact.
    *
    * @tags packages_pypi
    * @name GetApiV4ProjectsIdPackagesPypiForwardPackageNameUpstreamPath
    * @summary Download a forwarded (proxied) PyPI package file
    * @request GET:/api/v4/projects/{id}/packages/pypi/forward/{package_name}/*upstream_path
    */
    getApiV4ProjectsIdPackagesPypiForwardPackageNameUpstreamPath: (id, packageName, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/pypi/forward/${packageName}/*upstream_path`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Lists all packages for a specified project in an HTML file.
    *
    * @tags packages_pypi
    * @name GetApiV4ProjectsIdPackagesPypiSimple
    * @summary List all packages for a project
    * @request GET:/api/v4/projects/{id}/packages/pypi/simple
    */
    getApiV4ProjectsIdPackagesPypiSimple: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/pypi/simple`,
      method: "GET",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.10
    *
    * @tags packages_pypi
    * @name GetApiV4ProjectsIdPackagesPypiSimplePackageName
    * @summary The PyPi Simple Project Package Endpoint
    * @request GET:/api/v4/projects/{id}/packages/pypi/simple/*package_name
    */
    getApiV4ProjectsIdPackagesPypiSimplePackageName: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/pypi/simple/*package_name`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Uploads a PyPI package for a specified project.
    *
    * @tags packages_pypi
    * @name PostApiV4ProjectsIdPackagesPypi
    * @summary Upload a package
    * @request POST:/api/v4/projects/{id}/packages/pypi
    */
    postApiV4ProjectsIdPackagesPypi: (id, postApiV4ProjectsIdPackagesPypi, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/pypi`,
      method: "POST",
      body: postApiV4ProjectsIdPackagesPypi,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.10
    *
    * @tags packages_pypi
    * @name PostApiV4ProjectsIdPackagesPypiAuthorize
    * @summary Authorize the PyPi package upload from workhorse
    * @request POST:/api/v4/projects/{id}/packages/pypi/authorize
    */
    postApiV4ProjectsIdPackagesPypiAuthorize: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/pypi/authorize`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all releases for a specified project. Sorted by `released_at`.
    *
    * @tags releases
    * @name GetApiV4ProjectsIdReleases
    * @summary List all releases in a project
    * @request GET:/api/v4/projects/{id}/releases
    */
    getApiV4ProjectsIdReleases: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/releases`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a release. Developer level access to the project is required to create a release.
    *
    * @tags releases
    * @name PostApiV4ProjectsIdReleases
    * @summary Create a release
    * @request POST:/api/v4/projects/{id}/releases
    */
    postApiV4ProjectsIdReleases: (id, postApiV4ProjectsIdReleases, params = {}) => this.request({
      path: `/api/v4/projects/${id}/releases`,
      method: "POST",
      body: postApiV4ProjectsIdReleases,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a release with a specified tag name.
    *
    * @tags releases
    * @name GetApiV4ProjectsIdReleasesTagName
    * @summary Retrieve a release by tag name
    * @request GET:/api/v4/projects/{id}/releases/{tag_name}
    */
    getApiV4ProjectsIdReleasesTagName: (id, tagName, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/releases/${tagName}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Updates a release. Developer level access to the project is required to update a release.
    *
    * @tags releases
    * @name PutApiV4ProjectsIdReleasesTagName
    * @summary Update a release
    * @request PUT:/api/v4/projects/{id}/releases/{tag_name}
    */
    putApiV4ProjectsIdReleasesTagName: (id, tagName, putApiV4ProjectsIdReleasesTagName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/releases/${tagName}`,
      method: "PUT",
      body: putApiV4ProjectsIdReleasesTagName,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Delete a release. Deleting a release doesn't delete the associated tag. Requires at least the Developer role for the project. This feature was introduced in GitLab 11.7.
    *
    * @tags releases
    * @name DeleteApiV4ProjectsIdReleasesTagName
    * @summary Delete a release
    * @request DELETE:/api/v4/projects/{id}/releases/{tag_name}
    */
    deleteApiV4ProjectsIdReleasesTagName: (id, tagName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/releases/${tagName}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.4.
    *
    * @tags releases
    * @name GetApiV4ProjectsIdReleasesTagNameDownloadsDirectAssetPath
    * @summary Download a project release asset file
    * @request GET:/api/v4/projects/{id}/releases/{tag_name}/downloads/*direct_asset_path
    */
    getApiV4ProjectsIdReleasesTagNameDownloadsDirectAssetPath: (id, tagName, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/releases/${tagName}/downloads/*direct_asset_path`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.4.
    *
    * @tags releases
    * @name GetApiV4ProjectsIdReleasesPermalinkLatestSuffixPath
    * @summary Get the latest project release
    * @request GET:/api/v4/projects/{id}/releases/permalink/latest(/)Usuffix_path
    */
    getApiV4ProjectsIdReleasesPermalinkLatestSuffixPath: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/releases/permalink/latest(/)Usuffix_path`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Generates an evidence for an existing release.
    *
    * @tags releases
    * @name PostApiV4ProjectsIdReleasesTagNameEvidence
    * @summary Generate release evidence
    * @request POST:/api/v4/projects/{id}/releases/{tag_name}/evidence
    */
    postApiV4ProjectsIdReleasesTagNameEvidence: (tagName, id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/releases/${tagName}/evidence`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all assets as links from a release.
    *
    * @tags releases
    * @name GetApiV4ProjectsIdReleasesTagNameAssetsLinks
    * @summary List all release links
    * @request GET:/api/v4/projects/{id}/releases/{tag_name}/assets/links
    */
    getApiV4ProjectsIdReleasesTagNameAssetsLinks: (id, tagName, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/releases/${tagName}/assets/links`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates an asset link for a specified release.
    *
    * @tags releases
    * @name PostApiV4ProjectsIdReleasesTagNameAssetsLinks
    * @summary Create a release link
    * @request POST:/api/v4/projects/{id}/releases/{tag_name}/assets/links
    */
    postApiV4ProjectsIdReleasesTagNameAssetsLinks: (id, tagName, postApiV4ProjectsIdReleasesTagNameAssetsLinks, params = {}) => this.request({
      path: `/api/v4/projects/${id}/releases/${tagName}/assets/links`,
      method: "POST",
      body: postApiV4ProjectsIdReleasesTagNameAssetsLinks,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified asset as a link from a release.
    *
    * @tags releases
    * @name GetApiV4ProjectsIdReleasesTagNameAssetsLinksLinkId
    * @summary Retrieve a release link
    * @request GET:/api/v4/projects/{id}/releases/{tag_name}/assets/links/{link_id}
    */
    getApiV4ProjectsIdReleasesTagNameAssetsLinksLinkId: (id, tagName, linkId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/releases/${tagName}/assets/links/${linkId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified asset link for a release.
    *
    * @tags releases
    * @name PutApiV4ProjectsIdReleasesTagNameAssetsLinksLinkId
    * @summary Update a release link
    * @request PUT:/api/v4/projects/{id}/releases/{tag_name}/assets/links/{link_id}
    */
    putApiV4ProjectsIdReleasesTagNameAssetsLinksLinkId: (id, tagName, linkId, putApiV4ProjectsIdReleasesTagNameAssetsLinksLinkId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/releases/${tagName}/assets/links/${linkId}`,
      method: "PUT",
      body: putApiV4ProjectsIdReleasesTagNameAssetsLinksLinkId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified asset link from a release.
    *
    * @tags releases
    * @name DeleteApiV4ProjectsIdReleasesTagNameAssetsLinksLinkId
    * @summary Delete a release link
    * @request DELETE:/api/v4/projects/{id}/releases/{tag_name}/assets/links/{link_id}
    */
    deleteApiV4ProjectsIdReleasesTagNameAssetsLinksLinkId: (id, tagName, linkId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/releases/${tagName}/assets/links/${linkId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all remote mirrors for a specified project.
    *
    * @tags remote_mirrors
    * @name GetApiV4ProjectsIdRemoteMirrors
    * @summary List all remote mirrors for a project
    * @request GET:/api/v4/projects/{id}/remote_mirrors
    */
    getApiV4ProjectsIdRemoteMirrors: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/remote_mirrors`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a push mirror.
    *
    * @tags remote_mirrors
    * @name PostApiV4ProjectsIdRemoteMirrors
    * @summary Create a push mirror
    * @request POST:/api/v4/projects/{id}/remote_mirrors
    */
    postApiV4ProjectsIdRemoteMirrors: (id, postApiV4ProjectsIdRemoteMirrors, params = {}) => this.request({
      path: `/api/v4/projects/${id}/remote_mirrors`,
      method: "POST",
      body: postApiV4ProjectsIdRemoteMirrors,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified remote mirror for a project.
    *
    * @tags remote_mirrors
    * @name GetApiV4ProjectsIdRemoteMirrorsMirrorId
    * @summary Retrieve a remote mirror for a project
    * @request GET:/api/v4/projects/{id}/remote_mirrors/{mirror_id}
    */
    getApiV4ProjectsIdRemoteMirrorsMirrorId: (id, mirrorId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/remote_mirrors/${mirrorId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates the configuration or operational status of a specified remote mirror.
    *
    * @tags remote_mirrors
    * @name PutApiV4ProjectsIdRemoteMirrorsMirrorId
    * @summary Update a remote mirror in a project
    * @request PUT:/api/v4/projects/{id}/remote_mirrors/{mirror_id}
    */
    putApiV4ProjectsIdRemoteMirrorsMirrorId: (id, mirrorId, putApiV4ProjectsIdRemoteMirrorsMirrorId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/remote_mirrors/${mirrorId}`,
      method: "PUT",
      body: putApiV4ProjectsIdRemoteMirrorsMirrorId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified remote mirror from a project.
    *
    * @tags remote_mirrors
    * @name DeleteApiV4ProjectsIdRemoteMirrorsMirrorId
    * @summary Delete a remote mirror from a project
    * @request DELETE:/api/v4/projects/{id}/remote_mirrors/{mirror_id}
    */
    deleteApiV4ProjectsIdRemoteMirrorsMirrorId: (id, mirrorId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/remote_mirrors/${mirrorId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Forces an update to a push mirror.
    *
    * @tags remote_mirrors
    * @name PostApiV4ProjectsIdRemoteMirrorsMirrorIdSync
    * @summary Force push mirror update
    * @request POST:/api/v4/projects/{id}/remote_mirrors/{mirror_id}/sync
    */
    postApiV4ProjectsIdRemoteMirrorsMirrorIdSync: (id, mirrorId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/remote_mirrors/${mirrorId}/sync`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Retrieves the public key of a specified remote mirror that uses SSH authentication.
    *
    * @tags remote_mirrors
    * @name GetApiV4ProjectsIdRemoteMirrorsMirrorIdPublicKey
    * @summary Retrieve a public key for a remote mirror
    * @request GET:/api/v4/projects/{id}/remote_mirrors/{mirror_id}/public_key
    */
    getApiV4ProjectsIdRemoteMirrorsMirrorIdPublicKey: (id, mirrorId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/remote_mirrors/${mirrorId}/public_key`,
      method: "GET",
      ...params
    }),
    /**
    * @description Lists all repository files and directories in a specified project. This endpoint can be accessed without authentication if the repository is publicly accessible. This command provides essentially the same features as the `git ls-tree` command. Use `with_last_commit` to include the last commit that changed each entry. `with_last_commit` cannot be combined with `recursive`.
    *
    * @tags repositories
    * @name GetApiV4ProjectsIdRepositoryTree
    * @summary List all repository trees in a project
    * @request GET:/api/v4/projects/{id}/repository/tree
    */
    getApiV4ProjectsIdRepositoryTree: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/tree`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the raw file contents for a blob, by blob SHA. This endpoint can be accessed without authentication if the repository is publicly accessible.
    *
    * @tags repositories
    * @name GetApiV4ProjectsIdRepositoryBlobsShaRaw
    * @summary Retrieve raw blob content
    * @request GET:/api/v4/projects/{id}/repository/blobs/{sha}/raw
    */
    getApiV4ProjectsIdRepositoryBlobsShaRaw: (id, sha, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/blobs/${sha}/raw`,
      method: "GET",
      ...params
    }),
    /**
    * @description Retrieves information, such as size and content, about blobs in a repository. Blob content is Base64 encoded. This endpoint can be accessed without authentication, if the repository is publicly accessible.
    *
    * @tags repositories
    * @name GetApiV4ProjectsIdRepositoryBlobsSha
    * @summary Retrieve a blob from a repository
    * @request GET:/api/v4/projects/{id}/repository/blobs/{sha}
    */
    getApiV4ProjectsIdRepositoryBlobsSha: (id, sha, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/blobs/${sha}`,
      method: "GET",
      ...params
    }),
    /**
    * @description Retrieves the file archive of a specified repository. This endpoint can be accessed without authentication if the repository is publicly accessible. For GitLab.com users, this endpoint has a rate limit threshold of 5 requests per minute.
    *
    * @tags repositories
    * @name GetApiV4ProjectsIdRepositoryArchive
    * @summary Retrieve file archive from a repository
    * @request GET:/api/v4/projects/{id}/repository/archive
    */
    getApiV4ProjectsIdRepositoryArchive: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/archive`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Compares branches, tags, or commits. Retrieves the differences between two branches, tags, or commits in a specified project.
    *
    * @tags repositories
    * @name GetApiV4ProjectsIdRepositoryCompare
    * @summary Compare branches, tags, or commits
    * @request GET:/api/v4/projects/{id}/repository/compare
    */
    getApiV4ProjectsIdRepositoryCompare: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/compare`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves statistics related to the health of a project repository. This endpoint is rate-limited to 5 requests/hour per project when `generate` is `true`. Available only to users with push access to the repository.
    *
    * @tags repositories
    * @name GetApiV4ProjectsIdRepositoryHealth
    * @summary Retrieve repository health statistics
    * @request GET:/api/v4/projects/{id}/repository/health
    */
    getApiV4ProjectsIdRepositoryHealth: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/health`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a list of contributors to a specified repository.
    *
    * @tags repositories
    * @name GetApiV4ProjectsIdRepositoryContributors
    * @summary Retrieve contributors metrics
    * @request GET:/api/v4/projects/{id}/repository/contributors
    */
    getApiV4ProjectsIdRepositoryContributors: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/contributors`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the merge base for two specified commits.
    *
    * @tags repositories
    * @name GetApiV4ProjectsIdRepositoryMergeBase
    * @summary Retrieve a merge base
    * @request GET:/api/v4/projects/{id}/repository/merge_base
    */
    getApiV4ProjectsIdRepositoryMergeBase: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/merge_base`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Each blob is truncated to the first 1 MB; the `truncated` field indicates when this happens.
    *
    * @tags repositories
    * @name PostApiV4ProjectsIdRepositoryBlobsBatch
    * @summary Get contents of multiple files in a single request
    * @request POST:/api/v4/projects/{id}/repository/blobs/batch
    */
    postApiV4ProjectsIdRepositoryBlobsBatch: (id, postApiV4ProjectsIdRepositoryBlobsBatch, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/blobs/batch`,
      method: "POST",
      body: postApiV4ProjectsIdRepositoryBlobsBatch,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieve diverging commit counts between two refs
    *
    * @tags repositories
    * @name GetApiV4ProjectsIdRepositoryDivergingCommits
    * @request GET:/api/v4/projects/{id}/repository/diverging_commits
    */
    getApiV4ProjectsIdRepositoryDivergingCommits: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/diverging_commits`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Generates changelog data based on commits in a repository, without committing them to a changelog file. Works exactly like `POST /projects/:id/repository/changelog`, except the changelog data is not committed to any changelog file.
    *
    * @tags repositories
    * @name GetApiV4ProjectsIdRepositoryChangelog
    * @summary Generate changelog data
    * @request GET:/api/v4/projects/{id}/repository/changelog
    */
    getApiV4ProjectsIdRepositoryChangelog: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/changelog`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Adds changelog data to file.
    *
    * @tags repositories
    * @name PostApiV4ProjectsIdRepositoryChangelog
    * @summary Add changelog data to file
    * @request POST:/api/v4/projects/{id}/repository/changelog
    */
    postApiV4ProjectsIdRepositoryChangelog: (id, postApiV4ProjectsIdRepositoryChangelog, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/changelog`,
      method: "POST",
      body: postApiV4ProjectsIdRepositoryChangelog,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Rotates a project access token by passing it to the API in a header.
    *
    * @tags access_tokens
    * @name PostApiV4ProjectsIdAccessTokensSelfRotate
    * @summary Rotate a project access token
    * @request POST:/api/v4/projects/{id}/access_tokens/self/rotate
    */
    postApiV4ProjectsIdAccessTokensSelfRotate: (id, postApiV4ProjectsIdAccessTokensSelfRotate, params = {}) => this.request({
      path: `/api/v4/projects/${id}/access_tokens/self/rotate`,
      method: "POST",
      body: postApiV4ProjectsIdAccessTokensSelfRotate,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all milestone events for a specified issue.
    *
    * @tags resource_events
    * @name GetApiV4ProjectsIdIssuesEventableIdResourceMilestoneEvents
    * @summary List all project issue milestone events
    * @request GET:/api/v4/projects/{id}/issues/{eventable_id}/resource_milestone_events
    */
    getApiV4ProjectsIdIssuesEventableIdResourceMilestoneEvents: (id, eventableId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${eventableId}/resource_milestone_events`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified milestone event for a project issue.
    *
    * @tags resource_events
    * @name GetApiV4ProjectsIdIssuesEventableIdResourceMilestoneEventsEventId
    * @summary Retrieve an issue milestone event
    * @request GET:/api/v4/projects/{id}/issues/{eventable_id}/resource_milestone_events/{event_id}
    */
    getApiV4ProjectsIdIssuesEventableIdResourceMilestoneEventsEventId: (id, eventId, eventableId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/issues/${eventableId}/resource_milestone_events/${eventId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all milestone events for a specified merge request.
    *
    * @tags resource_events
    * @name GetApiV4ProjectsIdMergeRequestsEventableIdResourceMilestoneEvents
    * @summary List all project merge request milestone events
    * @request GET:/api/v4/projects/{id}/merge_requests/{eventable_id}/resource_milestone_events
    */
    getApiV4ProjectsIdMergeRequestsEventableIdResourceMilestoneEvents: (id, eventableId, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${eventableId}/resource_milestone_events`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified milestone event for a project merge request.
    *
    * @tags resource_events
    * @name GetApiV4ProjectsIdMergeRequestsEventableIdResourceMilestoneEventsEventId
    * @summary Retrieve a merge request milestone event
    * @request GET:/api/v4/projects/{id}/merge_requests/{eventable_id}/resource_milestone_events/{event_id}
    */
    getApiV4ProjectsIdMergeRequestsEventableIdResourceMilestoneEventsEventId: (id, eventId, eventableId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/merge_requests/${eventableId}/resource_milestone_events/${eventId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.7
    *
    * @tags packages_rpm
    * @name GetApiV4ProjectsIdPackagesRpmRepodataFileName
    * @summary Download repository metadata files
    * @request GET:/api/v4/projects/{id}/packages/rpm/repodata/*file_name
    */
    getApiV4ProjectsIdPackagesRpmRepodataFileName: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/rpm/repodata/*file_name`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.7
    *
    * @tags packages_rpm
    * @name GetApiV4ProjectsIdPackagesRpmPackageFileIdFileName
    * @summary Download RPM package files
    * @request GET:/api/v4/projects/{id}/packages/rpm/*package_file_id/*file_name
    */
    getApiV4ProjectsIdPackagesRpmPackageFileIdFileName: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/rpm/*package_file_id/*file_name`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.7
    *
    * @tags packages_rpm
    * @name PostApiV4ProjectsIdPackagesRpm
    * @summary Upload a RPM package
    * @request POST:/api/v4/projects/{id}/packages/rpm
    */
    postApiV4ProjectsIdPackagesRpm: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/rpm`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.7
    *
    * @tags packages_rpm
    * @name PostApiV4ProjectsIdPackagesRpmAuthorize
    * @summary Authorize package upload from workhorse
    * @request POST:/api/v4/projects/{id}/packages/rpm/authorize
    */
    postApiV4ProjectsIdPackagesRpmAuthorize: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/rpm/authorize`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Downloads a RubyGems spec index file (specs.4.8.gz, latest_specs.4.8.gz, or prerelease_specs.4.8.gz) for a project.
    *
    * @tags packages_rubygem
    * @name GetApiV4ProjectsIdPackagesRubygemsFileName
    * @summary Download the spec index file
    * @request GET:/api/v4/projects/{id}/packages/rubygems/{file_name}
    */
    getApiV4ProjectsIdPackagesRubygemsFileName: (id, fileName, data, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/rubygems/${fileName}`,
      method: "GET",
      body: data,
      ...params
    }),
    /**
    * @description Downloads a gemspec file in Marshal format for a specified gem version.
    *
    * @tags packages_rubygem
    * @name GetApiV4ProjectsIdPackagesRubygemsQuickMarshal48FileName
    * @summary Download a gemspec file
    * @request GET:/api/v4/projects/{id}/packages/rubygems/quick/Marshal.4.8/{file_name}
    */
    getApiV4ProjectsIdPackagesRubygemsQuickMarshal48FileName: (id, fileName, data, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/rubygems/quick/Marshal.4.8/${fileName}`,
      method: "GET",
      body: data,
      ...params
    }),
    /**
    * @description Downloads a specified gem file for a project.
    *
    * @tags packages_rubygem
    * @name GetApiV4ProjectsIdPackagesRubygemsGemsFileName
    * @summary Download a gem file
    * @request GET:/api/v4/projects/{id}/packages/rubygems/gems/{file_name}
    */
    getApiV4ProjectsIdPackagesRubygemsGemsFileName: (id, fileName, data, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/rubygems/gems/${fileName}`,
      method: "GET",
      body: data,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.9
    *
    * @tags packages_rubygem
    * @name PostApiV4ProjectsIdPackagesRubygemsApiV1GemsAuthorize
    * @summary Authorize a gem upload from workhorse
    * @request POST:/api/v4/projects/{id}/packages/rubygems/api/v1/gems/authorize
    */
    postApiV4ProjectsIdPackagesRubygemsApiV1GemsAuthorize: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/rubygems/api/v1/gems/authorize`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Uploads a gem for a specified project.
    *
    * @tags packages_rubygem
    * @name PostApiV4ProjectsIdPackagesRubygemsApiV1Gems
    * @summary Upload a gem
    * @request POST:/api/v4/projects/{id}/packages/rubygems/api/v1/gems
    */
    postApiV4ProjectsIdPackagesRubygemsApiV1Gems: (id, postApiV4ProjectsIdPackagesRubygemsApiV1Gems, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/rubygems/api/v1/gems`,
      method: "POST",
      body: postApiV4ProjectsIdPackagesRubygemsApiV1Gems,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Retrieves a list of dependencies for specified gems. The response is a marshalled array of hashes for all versions of the requested gems. Because the response is marshalled, you can store it in a file.
    *
    * @tags packages_rubygem
    * @name GetApiV4ProjectsIdPackagesRubygemsApiV1Dependencies
    * @summary Retrieve dependencies
    * @request GET:/api/v4/projects/{id}/packages/rubygems/api/v1/dependencies
    */
    getApiV4ProjectsIdPackagesRubygemsApiV1Dependencies: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/rubygems/api/v1/dependencies`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Searches for content in a specified project.
    *
    * @tags search, projects
    * @name GetApiV4ProjectsIdSearch
    * @summary Search a project
    * @request GET:/api/v4/projects/{id}/(-/)search
    */
    getApiV4ProjectsIdSearch: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/(-/)search`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Updates a reference for a specified submodule.
    *
    * @tags submodules
    * @name PutApiV4ProjectsIdRepositorySubmodulesSubmodule
    * @summary Update a submodule reference
    * @request PUT:/api/v4/projects/{id}/repository/submodules/{submodule}
    */
    putApiV4ProjectsIdRepositorySubmodulesSubmodule: (id, submodule, putApiV4ProjectsIdRepositorySubmodulesSubmodule, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/submodules/${submodule}`,
      method: "PUT",
      body: putApiV4ProjectsIdRepositorySubmodulesSubmodule,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all attestations for a specified project and artifact hash. This feature was introduced in GitLab 18.7.
    *
    * @tags attestations
    * @name GetApiV4ProjectsIdAttestationsSubjectDigest
    * @summary List all attestations for a project
    * @request GET:/api/v4/projects/{id}/attestations/{subject_digest}
    */
    getApiV4ProjectsIdAttestationsSubjectDigest: (id, subjectDigest, params = {}) => this.request({
      path: `/api/v4/projects/${id}/attestations/${subjectDigest}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 18.7
    *
    * @tags attestations
    * @name GetApiV4ProjectsIdAttestationsAttestationIidDownload
    * @summary Retrieve an attestation bundle
    * @request GET:/api/v4/projects/{id}/attestations/{attestation_iid}/download
    */
    getApiV4ProjectsIdAttestationsAttestationIidDownload: (id, attestationIid, params = {}) => this.request({
      path: `/api/v4/projects/${id}/attestations/${attestationIid}/download`,
      method: "GET",
      ...params
    }),
    /**
    * @description Lists all repository tags from a project, sorted by update date and time in descending order.
    *
    * @tags tags
    * @name GetApiV4ProjectsIdRepositoryTags
    * @summary List all project repository tags
    * @request GET:/api/v4/projects/{id}/repository/tags
    */
    getApiV4ProjectsIdRepositoryTags: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/tags`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a tag in the repository that points to a specified reference.
    *
    * @tags tags
    * @name PostApiV4ProjectsIdRepositoryTags
    * @summary Create a tag
    * @request POST:/api/v4/projects/{id}/repository/tags
    */
    postApiV4ProjectsIdRepositoryTags: (id, postApiV4ProjectsIdRepositoryTags, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/tags`,
      method: "POST",
      body: postApiV4ProjectsIdRepositoryTags,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a repository tag with a specified name. This endpoint can be accessed without authentication if the repository is publicly accessible.
    *
    * @tags tags
    * @name GetApiV4ProjectsIdRepositoryTagsTagName
    * @summary Retrieve a single repository tag
    * @request GET:/api/v4/projects/{id}/repository/tags/{tag_name}
    */
    getApiV4ProjectsIdRepositoryTagsTagName: (id, tagName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/tags/${tagName}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified repository tag.
    *
    * @tags tags
    * @name DeleteApiV4ProjectsIdRepositoryTagsTagName
    * @summary Delete a tag
    * @request DELETE:/api/v4/projects/{id}/repository/tags/{tag_name}
    */
    deleteApiV4ProjectsIdRepositoryTagsTagName: (id, tagName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/tags/${tagName}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Retrieves the X.509 signature from a signed tag. Unsigned tags return a `404 Not Found` response.
    *
    * @tags tags
    * @name GetApiV4ProjectsIdRepositoryTagsTagNameSignature
    * @summary Retrieve X.509 signature of a tag
    * @request GET:/api/v4/projects/{id}/repository/tags/{tag_name}/signature
    */
    getApiV4ProjectsIdRepositoryTagsTagNameSignature: (id, tagName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/repository/tags/${tagName}/signature`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Downloads the latest version of a specified module. This feature was introduced in GitLab 16.7.
    *
    * @tags terraform
    * @name GetApiV4ProjectsIdPackagesTerraformModulesModuleNameModuleSystem
    * @summary Download the latest version of a module
    * @request GET:/api/v4/projects/{id}/packages/terraform/modules/{module_name}/{module_system}
    */
    getApiV4ProjectsIdPackagesTerraformModulesModuleNameModuleSystem: (id, moduleName, moduleSystem, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/terraform/modules/${moduleName}/${moduleSystem}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 16.7
    *
    * @tags terraform
    * @name GetApiV4ProjectsIdPackagesTerraformModulesModuleNameModuleSystemModuleVersion
    * @summary Download a specific version of a module
    * @request GET:/api/v4/projects/{id}/packages/terraform/modules/{module_name}/{module_system}/*module_version
    */
    getApiV4ProjectsIdPackagesTerraformModulesModuleNameModuleSystemModuleVersion: (id, moduleName, moduleSystem, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/terraform/modules/${moduleName}/${moduleSystem}/*module_version`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.11
    *
    * @tags terraform
    * @name PutApiV4ProjectsIdPackagesTerraformModulesModuleNameModuleSystemModuleVersionFileAuthorize
    * @summary Workhorse authorize Terraform Module package file
    * @request PUT:/api/v4/projects/{id}/packages/terraform/modules/{module_name}/{module_system}/*module_version/file/authorize
    */
    putApiV4ProjectsIdPackagesTerraformModulesModuleNameModuleSystemModuleVersionFileAuthorize: (id, moduleName, moduleSystem, putApiV4ProjectsIdPackagesTerraformModulesModuleNameModuleSystemmoduleVersionFileAuthorize, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/terraform/modules/${moduleName}/${moduleSystem}/*module_version/file/authorize`,
      method: "PUT",
      body: putApiV4ProjectsIdPackagesTerraformModulesModuleNameModuleSystemmoduleVersionFileAuthorize,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.11
    *
    * @tags terraform
    * @name PutApiV4ProjectsIdPackagesTerraformModulesModuleNameModuleSystemModuleVersionFile
    * @summary Upload Terraform Module package file
    * @request PUT:/api/v4/projects/{id}/packages/terraform/modules/{module_name}/{module_system}/*module_version/file
    */
    putApiV4ProjectsIdPackagesTerraformModulesModuleNameModuleSystemModuleVersionFile: (id, moduleName, moduleSystem, data, params = {}) => this.request({
      path: `/api/v4/projects/${id}/packages/terraform/modules/${moduleName}/${moduleSystem}/*module_version/file`,
      method: "PUT",
      body: data,
      type: "multipart/form-data" /* FormData */,
      ...params
    }),
    /**
    * @description Retrieves a Terraform state by name for a specified project.
    *
    * @tags terraform
    * @name GetApiV4ProjectsIdTerraformStateName
    * @summary Retrieve a Terraform state
    * @request GET:/api/v4/projects/{id}/terraform/state/{name}
    */
    getApiV4ProjectsIdTerraformStateName: (id, name, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/terraform/state/${name}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Creates or updates a Terraform state for a specified project.
    *
    * @tags terraform
    * @name PostApiV4ProjectsIdTerraformStateName
    * @summary Create or update a Terraform state
    * @request POST:/api/v4/projects/{id}/terraform/state/{name}
    */
    postApiV4ProjectsIdTerraformStateName: (id, name, postApiV4ProjectsIdTerraformStateName, params = {}) => this.request({
      path: `/api/v4/projects/${id}/terraform/state/${name}`,
      method: "POST",
      body: postApiV4ProjectsIdTerraformStateName,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Deletes a Terraform state for a specified project.
    *
    * @tags terraform
    * @name DeleteApiV4ProjectsIdTerraformStateName
    * @summary Delete a Terraform state
    * @request DELETE:/api/v4/projects/{id}/terraform/state/{name}
    */
    deleteApiV4ProjectsIdTerraformStateName: (id, name, params = {}) => this.request({
      path: `/api/v4/projects/${id}/terraform/state/${name}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Authorizes uploading a Terraform state for a specified project. This feature was introduced in GitLab 18.5.
    *
    * @tags terraform
    * @name PostApiV4ProjectsIdTerraformStateNameAuthorize
    * @summary Authorize Terraform state upload
    * @request POST:/api/v4/projects/{id}/terraform/state/{name}/authorize
    */
    postApiV4ProjectsIdTerraformStateNameAuthorize: (id, name, params = {}) => this.request({
      path: `/api/v4/projects/${id}/terraform/state/${name}/authorize`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Locks a Terraform state for a specified project.
    *
    * @tags terraform
    * @name PostApiV4ProjectsIdTerraformStateNameLock
    * @summary Lock a Terraform state
    * @request POST:/api/v4/projects/{id}/terraform/state/{name}/lock
    */
    postApiV4ProjectsIdTerraformStateNameLock: (id, name, postApiV4ProjectsIdTerraformStateNameLock, params = {}) => this.request({
      path: `/api/v4/projects/${id}/terraform/state/${name}/lock`,
      method: "POST",
      body: postApiV4ProjectsIdTerraformStateNameLock,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Unlocks a Terraform state for a specified project.
    *
    * @tags terraform
    * @name DeleteApiV4ProjectsIdTerraformStateNameLock
    * @summary Unlock a Terraform state
    * @request DELETE:/api/v4/projects/{id}/terraform/state/{name}/lock
    */
    deleteApiV4ProjectsIdTerraformStateNameLock: (id, name, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/terraform/state/${name}/lock`,
      method: "DELETE",
      query,
      ...params
    }),
    /**
    * @description Lists all Terraform state protection rules for a project. This feature was introduced in GitLab 18.11.
    *
    * @tags projects
    * @name GetApiV4ProjectsIdTerraformStateProtectionRules
    * @summary List all Terraform state protection rules for a project
    * @request GET:/api/v4/projects/{id}/terraform/state_protection_rules
    */
    getApiV4ProjectsIdTerraformStateProtectionRules: (id, params = {}) => this.request({
      path: `/api/v4/projects/${id}/terraform/state_protection_rules`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 19.1.
    *
    * @tags projects
    * @name PostApiV4ProjectsIdTerraformStateProtectionRules
    * @summary Create a Terraform state protection rule for a project
    * @request POST:/api/v4/projects/{id}/terraform/state_protection_rules
    */
    postApiV4ProjectsIdTerraformStateProtectionRules: (id, postApiV4ProjectsIdTerraformStateProtectionRules, params = {}) => this.request({
      path: `/api/v4/projects/${id}/terraform/state_protection_rules`,
      method: "POST",
      body: postApiV4ProjectsIdTerraformStateProtectionRules,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 19.0.
    *
    * @tags projects
    * @name PatchApiV4ProjectsIdTerraformStateProtectionRulesTerraformStateProtectionRuleId
    * @summary Update a Terraform state protection rule for a project
    * @request PATCH:/api/v4/projects/{id}/terraform/state_protection_rules/{terraform_state_protection_rule_id}
    */
    patchApiV4ProjectsIdTerraformStateProtectionRulesTerraformStateProtectionRuleId: (id, terraformStateProtectionRuleId, patchApiV4ProjectsIdTerraformStateProtectionRulesTerraformStateProtectionRuleId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/terraform/state_protection_rules/${terraformStateProtectionRuleId}`,
      method: "PATCH",
      body: patchApiV4ProjectsIdTerraformStateProtectionRulesTerraformStateProtectionRuleId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 19.0.
    *
    * @tags projects
    * @name DeleteApiV4ProjectsIdTerraformStateProtectionRulesTerraformStateProtectionRuleId
    * @summary Delete a Terraform state protection rule
    * @request DELETE:/api/v4/projects/{id}/terraform/state_protection_rules/{terraform_state_protection_rule_id}
    */
    deleteApiV4ProjectsIdTerraformStateProtectionRulesTerraformStateProtectionRuleId: (id, terraformStateProtectionRuleId, params = {}) => this.request({
      path: `/api/v4/projects/${id}/terraform/state_protection_rules/${terraformStateProtectionRuleId}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Retrieves a specified Terraform state version.
    *
    * @tags terraform
    * @name GetApiV4ProjectsIdTerraformStateNameVersionsSerial
    * @summary Retrieve a Terraform state version
    * @request GET:/api/v4/projects/{id}/terraform/state/{name}/versions/{serial}
    */
    getApiV4ProjectsIdTerraformStateNameVersionsSerial: (id, name, serial, params = {}) => this.request({
      path: `/api/v4/projects/${id}/terraform/state/${name}/versions/${serial}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified Terraform state version.
    *
    * @tags terraform
    * @name DeleteApiV4ProjectsIdTerraformStateNameVersionsSerial
    * @summary Delete a Terraform state version
    * @request DELETE:/api/v4/projects/{id}/terraform/state/{name}/versions/{serial}
    */
    deleteApiV4ProjectsIdTerraformStateNameVersionsSerial: (id, name, serial, params = {}) => this.request({
      path: `/api/v4/projects/${id}/terraform/state/${name}/versions/${serial}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all wiki pages for a specified project.
    *
    * @tags wikis
    * @name GetApiV4ProjectsIdWikis
    * @summary List all wiki pages for a project
    * @request GET:/api/v4/projects/{id}/wikis
    */
    getApiV4ProjectsIdWikis: (id, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/wikis`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a wiki page for a specified project. Requests can define the title, slug, and content.
    *
    * @tags wikis
    * @name PostApiV4ProjectsIdWikis
    * @summary Create a wiki page for a project
    * @request POST:/api/v4/projects/{id}/wikis
    */
    postApiV4ProjectsIdWikis: (id, postApiV4ProjectsIdWikis, params = {}) => this.request({
      path: `/api/v4/projects/${id}/wikis`,
      method: "POST",
      body: postApiV4ProjectsIdWikis,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified wiki page for a project.
    *
    * @tags wikis
    * @name GetApiV4ProjectsIdWikisSlug
    * @summary Retrieve a wiki page for a project
    * @request GET:/api/v4/projects/{id}/wikis/{slug}
    */
    getApiV4ProjectsIdWikisSlug: (id, slug, query, params = {}) => this.request({
      path: `/api/v4/projects/${id}/wikis/${slug}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified wiki page for a project.
    *
    * @tags wikis
    * @name PutApiV4ProjectsIdWikisSlug
    * @summary Update a wiki page for a project
    * @request PUT:/api/v4/projects/{id}/wikis/{slug}
    */
    putApiV4ProjectsIdWikisSlug: (id, slug, putApiV4ProjectsIdWikisSlug, params = {}) => this.request({
      path: `/api/v4/projects/${id}/wikis/${slug}`,
      method: "PUT",
      body: putApiV4ProjectsIdWikisSlug,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified wiki page from a project.
    *
    * @tags wikis
    * @name DeleteApiV4ProjectsIdWikisSlug
    * @summary Delete a wiki page for a project
    * @request DELETE:/api/v4/projects/{id}/wikis/{slug}
    */
    deleteApiV4ProjectsIdWikisSlug: (id, slug, params = {}) => this.request({
      path: `/api/v4/projects/${id}/wikis/${slug}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Uploads a file to the `uploads` directory in a specified project wiki.
    *
    * @tags wikis
    * @name PostApiV4ProjectsIdWikisAttachments
    * @summary Upload an attachment to a project wiki
    * @request POST:/api/v4/projects/{id}/wikis/attachments
    */
    postApiV4ProjectsIdWikisAttachments: (id, postApiV4ProjectsIdWikisAttachments, params = {}) => this.request({
      path: `/api/v4/projects/${id}/wikis/attachments`,
      method: "POST",
      body: postApiV4ProjectsIdWikisAttachments,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieve a batched background migration
    *
    * @tags batched_background_migrations
    * @name GetApiV4AdminBatchedBackgroundMigrationsId
    * @request GET:/api/v4/admin/batched_background_migrations/{id}
    */
    getApiV4AdminBatchedBackgroundMigrationsId: (id, query, params = {}) => this.request({
      path: `/api/v4/admin/batched_background_migrations/${id}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Resume a batched background migration
    *
    * @tags batched_background_migrations
    * @name PutApiV4AdminBatchedBackgroundMigrationsIdResume
    * @request PUT:/api/v4/admin/batched_background_migrations/{id}/resume
    */
    putApiV4AdminBatchedBackgroundMigrationsIdResume: (id, putApiV4AdminBatchedBackgroundMigrationsIdResume, params = {}) => this.request({
      path: `/api/v4/admin/batched_background_migrations/${id}/resume`,
      method: "PUT",
      body: putApiV4AdminBatchedBackgroundMigrationsIdResume,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Pause a batched background migration
    *
    * @tags batched_background_migrations
    * @name PutApiV4AdminBatchedBackgroundMigrationsIdPause
    * @request PUT:/api/v4/admin/batched_background_migrations/{id}/pause
    */
    putApiV4AdminBatchedBackgroundMigrationsIdPause: (id, putApiV4AdminBatchedBackgroundMigrationsIdPause, params = {}) => this.request({
      path: `/api/v4/admin/batched_background_migrations/${id}/pause`,
      method: "PUT",
      body: putApiV4AdminBatchedBackgroundMigrationsIdPause,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Get the list of batched background migrations
    *
    * @tags batched_background_migrations
    * @name GetApiV4AdminBatchedBackgroundMigrations
    * @request GET:/api/v4/admin/batched_background_migrations
    */
    getApiV4AdminBatchedBackgroundMigrations: (query, params = {}) => this.request({
      path: `/api/v4/admin/batched_background_migrations`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 19.1.
    *
    * @tags batched_background_operations
    * @name GetApiV4AdminBatchedBackgroundOperations
    * @summary Get the list of batched background operations
    * @request GET:/api/v4/admin/batched_background_operations
    */
    getApiV4AdminBatchedBackgroundOperations: (query, params = {}) => this.request({
      path: `/api/v4/admin/batched_background_operations`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 19.1.
    *
    * @tags batched_background_operations
    * @name GetApiV4AdminBatchedBackgroundOperationsId
    * @summary Retrieve a batched background operation
    * @request GET:/api/v4/admin/batched_background_operations/{id}
    */
    getApiV4AdminBatchedBackgroundOperationsId: (id, query, params = {}) => this.request({
      path: `/api/v4/admin/batched_background_operations/${id}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 19.2.
    *
    * @tags batched_background_operations
    * @name PutApiV4AdminBatchedBackgroundOperationsIdStop
    * @summary Stop a batched background operation
    * @request PUT:/api/v4/admin/batched_background_operations/{id}/stop
    */
    putApiV4AdminBatchedBackgroundOperationsIdStop: (id, putApiV4AdminBatchedBackgroundOperationsIdStop, params = {}) => this.request({
      path: `/api/v4/admin/batched_background_operations/${id}/stop`,
      method: "PUT",
      body: putApiV4AdminBatchedBackgroundOperationsIdStop,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 19.2.
    *
    * @tags batched_background_operations
    * @name PutApiV4AdminBatchedBackgroundOperationsIdRestart
    * @summary Restart a batched background operation
    * @request PUT:/api/v4/admin/batched_background_operations/{id}/restart
    */
    putApiV4AdminBatchedBackgroundOperationsIdRestart: (id, putApiV4AdminBatchedBackgroundOperationsIdRestart, params = {}) => this.request({
      path: `/api/v4/admin/batched_background_operations/${id}/restart`,
      method: "PUT",
      body: putApiV4AdminBatchedBackgroundOperationsIdRestart,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all instance-level variables. Use the `page` and `per_page` pagination parameters to control the pagination of results.
    *
    * @tags ci_variables
    * @name GetApiV4AdminCiVariables
    * @summary List all instance variables
    * @request GET:/api/v4/admin/ci/variables
    */
    getApiV4AdminCiVariables: (query, params = {}) => this.request({
      path: `/api/v4/admin/ci/variables`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a instance-level variable. The maximum number of instance-level variables can be changed.
    *
    * @tags ci_variables
    * @name PostApiV4AdminCiVariables
    * @summary Create instance variable
    * @request POST:/api/v4/admin/ci/variables
    */
    postApiV4AdminCiVariables: (postApiV4AdminCiVariables, params = {}) => this.request({
      path: `/api/v4/admin/ci/variables`,
      method: "POST",
      body: postApiV4AdminCiVariables,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves details of a specified instance-level variable.
    *
    * @tags ci_variables
    * @name GetApiV4AdminCiVariablesKey
    * @summary Retrieve instance variable details
    * @request GET:/api/v4/admin/ci/variables/{key}
    */
    getApiV4AdminCiVariablesKey: (key, params = {}) => this.request({
      path: `/api/v4/admin/ci/variables/${key}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified instance variable.
    *
    * @tags ci_variables
    * @name PutApiV4AdminCiVariablesKey
    * @summary Update an instance variable
    * @request PUT:/api/v4/admin/ci/variables/{key}
    */
    putApiV4AdminCiVariablesKey: (key, putApiV4AdminCiVariablesKey, params = {}) => this.request({
      path: `/api/v4/admin/ci/variables/${key}`,
      method: "PUT",
      body: putApiV4AdminCiVariablesKey,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified instance variable.
    *
    * @tags ci_variables
    * @name DeleteApiV4AdminCiVariablesKey
    * @summary Delete instance variable
    * @request DELETE:/api/v4/admin/ci/variables/{key}
    */
    deleteApiV4AdminCiVariablesKey: (key, params = {}) => this.request({
      path: `/api/v4/admin/ci/variables/${key}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Retrieve dictionary details
    *
    * @tags database_dictionary
    * @name GetApiV4AdminDatabasesDatabaseNameDictionaryTablesTableName
    * @request GET:/api/v4/admin/databases/{database_name}/dictionary/tables/{table_name}
    */
    getApiV4AdminDatabasesDatabaseNameDictionaryTablesTableName: (databaseName, tableName, params = {}) => this.request({
      path: `/api/v4/admin/databases/${databaseName}/dictionary/tables/${tableName}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all instance clusters for the instance.
    *
    * @tags clusters
    * @name GetApiV4AdminClusters
    * @summary List all instance clusters
    * @request GET:/api/v4/admin/clusters
    */
    getApiV4AdminClusters: (params = {}) => this.request({
      path: `/api/v4/admin/clusters`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified instance cluster.
    *
    * @tags clusters
    * @name GetApiV4AdminClustersClusterId
    * @summary Retrieve a single instance cluster
    * @request GET:/api/v4/admin/clusters/{cluster_id}
    */
    getApiV4AdminClustersClusterId: (clusterId, params = {}) => this.request({
      path: `/api/v4/admin/clusters/${clusterId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates an existing instance cluster.
    *
    * @tags clusters
    * @name PutApiV4AdminClustersClusterId
    * @summary Update an instance cluster
    * @request PUT:/api/v4/admin/clusters/{cluster_id}
    */
    putApiV4AdminClustersClusterId: (clusterId, putApiV4AdminClustersClusterId, params = {}) => this.request({
      path: `/api/v4/admin/clusters/${clusterId}`,
      method: "PUT",
      body: putApiV4AdminClustersClusterId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes an existing instance cluster. Does not remove existing resources in the connected Kubernetes cluster.
    *
    * @tags clusters
    * @name DeleteApiV4AdminClustersClusterId
    * @summary Delete instance cluster
    * @request DELETE:/api/v4/admin/clusters/{cluster_id}
    */
    deleteApiV4AdminClustersClusterId: (clusterId, params = {}) => this.request({
      path: `/api/v4/admin/clusters/${clusterId}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description Creates an instance cluster by adding an existing Kubernetes cluster.
    *
    * @tags clusters
    * @name PostApiV4AdminClustersAdd
    * @summary Create an instance cluster
    * @request POST:/api/v4/admin/clusters/add
    */
    postApiV4AdminClustersAdd: (postApiV4AdminClustersAdd, params = {}) => this.request({
      path: `/api/v4/admin/clusters/add`,
      method: "POST",
      body: postApiV4AdminClustersAdd,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all pending migrations for the instance.
    *
    * @tags migrations
    * @name GetApiV4AdminMigrationsPending
    * @summary List all pending migrations
    * @request GET:/api/v4/admin/migrations/pending
    */
    getApiV4AdminMigrationsPending: (query, params = {}) => this.request({
      path: `/api/v4/admin/migrations/pending`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Updates the status of a migration to indicate a successful execution. This prevent them from being executed by the `db:migrate` tasks. Use this API to skip failing migrations after you determine they are safe to skip.
    *
    * @tags migrations
    * @name PostApiV4AdminMigrationsTimestampMark
    * @summary Update status of a migration
    * @request POST:/api/v4/admin/migrations/{timestamp}/mark
    */
    postApiV4AdminMigrationsTimestampMark: (timestamp, postApiV4AdminMigrationsTimestampMark, params = {}) => this.request({
      path: `/api/v4/admin/migrations/${timestamp}/mark`,
      method: "POST",
      body: postApiV4AdminMigrationsTimestampMark,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all broadcast messages for the instance.
    *
    * @tags broadcast_messages
    * @name GetApiV4BroadcastMessages
    * @summary List all broadcast messages
    * @request GET:/api/v4/broadcast_messages
    */
    getApiV4BroadcastMessages: (query, params = {}) => this.request({
      path: `/api/v4/broadcast_messages`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a broadcast message.
    *
    * @tags broadcast_messages
    * @name PostApiV4BroadcastMessages
    * @summary Create a broadcast message
    * @request POST:/api/v4/broadcast_messages
    */
    postApiV4BroadcastMessages: (postApiV4BroadcastMessages, params = {}) => this.request({
      path: `/api/v4/broadcast_messages`,
      method: "POST",
      body: postApiV4BroadcastMessages,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified broadcast message.
    *
    * @tags broadcast_messages
    * @name GetApiV4BroadcastMessagesId
    * @summary Retrieve a broadcast message
    * @request GET:/api/v4/broadcast_messages/{id}
    */
    getApiV4BroadcastMessagesId: (id, params = {}) => this.request({
      path: `/api/v4/broadcast_messages/${id}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified broadcast message.
    *
    * @tags broadcast_messages
    * @name PutApiV4BroadcastMessagesId
    * @summary Update a broadcast message
    * @request PUT:/api/v4/broadcast_messages/{id}
    */
    putApiV4BroadcastMessagesId: (id, putApiV4BroadcastMessagesId, params = {}) => this.request({
      path: `/api/v4/broadcast_messages/${id}`,
      method: "PUT",
      body: putApiV4BroadcastMessagesId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified broadcast message.
    *
    * @tags broadcast_messages
    * @name DeleteApiV4BroadcastMessagesId
    * @summary Delete a broadcast message
    * @request DELETE:/api/v4/broadcast_messages/{id}
    */
    deleteApiV4BroadcastMessagesId: (id, params = {}) => this.request({
      path: `/api/v4/broadcast_messages/${id}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 10.5
    *
    * @tags applications
    * @name PostApiV4Applications
    * @summary Create a new application
    * @request POST:/api/v4/applications
    */
    postApiV4Applications: (postApiV4Applications, params = {}) => this.request({
      path: `/api/v4/applications`,
      method: "POST",
      body: postApiV4Applications,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description List all registered applications
    *
    * @tags applications
    * @name GetApiV4Applications
    * @summary Get applications
    * @request GET:/api/v4/applications
    */
    getApiV4Applications: (params = {}) => this.request({
      path: `/api/v4/applications`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Delete a specific application
    *
    * @tags applications
    * @name DeleteApiV4ApplicationsId
    * @summary Delete an application
    * @request DELETE:/api/v4/applications/{id}
    */
    deleteApiV4ApplicationsId: (id, params = {}) => this.request({
      path: `/api/v4/applications/${id}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Renew the secret of a specific application
    *
    * @tags applications
    * @name PostApiV4ApplicationsIdRenewSecret
    * @summary Renew an application secret
    * @request POST:/api/v4/applications/{id}/renew-secret
    */
    postApiV4ApplicationsIdRenewSecret: (id, params = {}) => this.request({
      path: `/api/v4/applications/${id}/renew-secret`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Return avatar url for a user
    *
    * @tags avatars
    * @name GetApiV4Avatar
    * @request GET:/api/v4/avatar
    */
    getApiV4Avatar: (query, params = {}) => this.request({
      path: `/api/v4/avatar`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Starts a group or project migration. To migrate a project, specify `entities[project_entity]`.
    *
    * @tags imports
    * @name PostApiV4BulkImports
    * @summary Start a group or project migration
    * @request POST:/api/v4/bulk_imports
    */
    postApiV4BulkImports: (data, params = {}) => this.request({
      path: `/api/v4/bulk_imports`,
      method: "POST",
      body: data,
      type: "application/x-www-form-urlencoded" /* UrlEncoded */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all group or project migrations.
    *
    * @tags imports
    * @name GetApiV4BulkImports
    * @summary List all group or project migrations
    * @request GET:/api/v4/bulk_imports
    */
    getApiV4BulkImports: (query, params = {}) => this.request({
      path: `/api/v4/bulk_imports`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all group or project migration entities.
    *
    * @tags imports
    * @name GetApiV4BulkImportsEntities
    * @summary List all group or project migration entities
    * @request GET:/api/v4/bulk_imports/entities
    */
    getApiV4BulkImportsEntities: (query, params = {}) => this.request({
      path: `/api/v4/bulk_imports/entities`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves details of a group or project migration.
    *
    * @tags imports
    * @name GetApiV4BulkImportsImportId
    * @summary Retrieve a group or project migration
    * @request GET:/api/v4/bulk_imports/{import_id}
    */
    getApiV4BulkImportsImportId: (importId, params = {}) => this.request({
      path: `/api/v4/bulk_imports/${importId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all group or project migration entities for a specified migration.
    *
    * @tags imports
    * @name GetApiV4BulkImportsImportIdEntities
    * @summary List all group or project migration entities
    * @request GET:/api/v4/bulk_imports/{import_id}/entities
    */
    getApiV4BulkImportsImportIdEntities: (importId, query, params = {}) => this.request({
      path: `/api/v4/bulk_imports/${importId}/entities`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves details of a group or project migration entity.
    *
    * @tags imports
    * @name GetApiV4BulkImportsImportIdEntitiesEntityId
    * @summary Retrieve a group or project migration entity
    * @request GET:/api/v4/bulk_imports/{import_id}/entities/{entity_id}
    */
    getApiV4BulkImportsImportIdEntitiesEntityId: (importId, entityId, params = {}) => this.request({
      path: `/api/v4/bulk_imports/${importId}/entities/${entityId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all failed import records for a group or project migration entity. This feature was introduced in GitLab 16.6.
    *
    * @tags imports
    * @name GetApiV4BulkImportsImportIdEntitiesEntityIdFailures
    * @summary List all failed import records for a migration entity
    * @request GET:/api/v4/bulk_imports/{import_id}/entities/{entity_id}/failures
    */
    getApiV4BulkImportsImportIdEntitiesEntityIdFailures: (importId, entityId, params = {}) => this.request({
      path: `/api/v4/bulk_imports/${importId}/entities/${entityId}/failures`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Cancels a direct transfer migration. This feature was introduced in GitLab 17.1.
    *
    * @tags imports
    * @name PostApiV4BulkImportsImportIdCancel
    * @summary Cancel a migration
    * @request POST:/api/v4/bulk_imports/{import_id}/cancel
    */
    postApiV4BulkImportsImportIdCancel: (importId, params = {}) => this.request({
      path: `/api/v4/bulk_imports/${importId}/cancel`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a job that was generated by a specified job token.
    *
    * @tags ci_jobs
    * @name GetApiV4Job
    * @summary Retrieve a job by job token
    * @request GET:/api/v4/job
    */
    getApiV4Job: (params = {}) => this.request({
      path: `/api/v4/job`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all GitLab agents for Kubernetes with a specified `CI_JOB_TOKEN`.
    *
    * @tags agents
    * @name GetApiV4JobAllowedAgents
    * @summary List all GitLab agents for Kubernetes by job token
    * @request GET:/api/v4/job/allowed_agents
    */
    getApiV4JobAllowedAgents: (params = {}) => this.request({
      path: `/api/v4/job/allowed_agents`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates a runner.
    *
    * @tags ci_runners
    * @name PostApiV4Runners
    * @summary Create a runner
    * @request POST:/api/v4/runners
    */
    postApiV4Runners: (postApiV4Runners, params = {}) => this.request({
      path: `/api/v4/runners`,
      method: "POST",
      body: postApiV4Runners,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified registered runner.
    *
    * @tags ci_runners
    * @name DeleteApiV4Runners
    * @summary Delete a runner by authentication token
    * @request DELETE:/api/v4/runners
    */
    deleteApiV4Runners: (query, params = {}) => this.request({
      path: `/api/v4/runners`,
      method: "DELETE",
      query,
      ...params
    }),
    /**
    * @description Lists all runners available to the user. For group runners, you must have the Owner role in the owner namespace.
    *
    * @tags runners
    * @name GetApiV4Runners
    * @summary List available runners
    * @request GET:/api/v4/runners
    */
    getApiV4Runners: (query, params = {}) => this.request({
      path: `/api/v4/runners`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Delete a registered runner manager
    *
    * @tags ci_runners
    * @name DeleteApiV4RunnersManagers
    * @summary Internal endpoint that deletes a runner manager by authentication token and system ID.
    * @request DELETE:/api/v4/runners/managers
    */
    deleteApiV4RunnersManagers: (query, params = {}) => this.request({
      path: `/api/v4/runners/managers`,
      method: "DELETE",
      query,
      ...params
    }),
    /**
    * @description Verifies authentication for a registered runner.
    *
    * @tags ci_runners
    * @name PostApiV4RunnersVerify
    * @summary Verify authentication for a registered runner
    * @request POST:/api/v4/runners/verify
    */
    postApiV4RunnersVerify: (postApiV4RunnersVerify, params = {}) => this.request({
      path: `/api/v4/runners/verify`,
      method: "POST",
      body: postApiV4RunnersVerify,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Resets a runner authentication token with the token used to authenticate the request.
    *
    * @tags ci_runners
    * @name PostApiV4RunnersResetAuthenticationToken
    * @summary Reset a runner authentication token with the current token
    * @request POST:/api/v4/runners/reset_authentication_token
    */
    postApiV4RunnersResetAuthenticationToken: (postApiV4RunnersResetAuthenticationToken, params = {}) => this.request({
      path: `/api/v4/runners/reset_authentication_token`,
      method: "POST",
      body: postApiV4RunnersResetAuthenticationToken,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Discovers Job Router information for a runner. You must provide a valid runner authentication token.
    *
    * @tags ci_runners
    * @name GetApiV4RunnersRouterDiscovery
    * @summary Discover Job Router information
    * @request GET:/api/v4/runners/router/discovery
    */
    getApiV4RunnersRouterDiscovery: (params = {}) => this.request({
      path: `/api/v4/runners/router/discovery`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all runners in the GitLab instance (project and shared). You must have either administrator access or auditor access.
    *
    * @tags runners
    * @name GetApiV4RunnersAll
    * @summary List all runners
    * @request GET:/api/v4/runners/all
    */
    getApiV4RunnersAll: (query, params = {}) => this.request({
      path: `/api/v4/runners/all`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves details of a runner. Instance runner details are available to all authenticated users through this endpoint. For groups and projects, you must have the Maintainer or Owner role for the associated project or group.
    *
    * @tags runners
    * @name GetApiV4RunnersId
    * @summary Retrieve details on a runner
    * @request GET:/api/v4/runners/{id}
    */
    getApiV4RunnersId: (id, query, params = {}) => this.request({
      path: `/api/v4/runners/${id}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified runner.
    *
    * @tags runners
    * @name PutApiV4RunnersId
    * @summary Update details of a runner
    * @request PUT:/api/v4/runners/{id}
    */
    putApiV4RunnersId: (id, putApiV4RunnersId, params = {}) => this.request({
      path: `/api/v4/runners/${id}`,
      method: "PUT",
      body: putApiV4RunnersId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified runner.
    *
    * @tags runners
    * @name DeleteApiV4RunnersId
    * @summary Delete a runner
    * @request DELETE:/api/v4/runners/{id}
    */
    deleteApiV4RunnersId: (id, params = {}) => this.request({
      path: `/api/v4/runners/${id}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description List all managers for a specified runner.
    *
    * @tags runners
    * @name GetApiV4RunnersIdManagers
    * @summary List all managers for a runner
    * @request GET:/api/v4/runners/{id}/managers
    */
    getApiV4RunnersIdManagers: (id, params = {}) => this.request({
      path: `/api/v4/runners/${id}/managers`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Get a paginated list of all projects associated with the specified runner. Access is restricted based on user permissions.
    *
    * @tags runners, projects
    * @name GetApiV4RunnersIdProjects
    * @summary List runner's projects
    * @request GET:/api/v4/runners/{id}/projects
    */
    getApiV4RunnersIdProjects: (id, query, params = {}) => this.request({
      path: `/api/v4/runners/${id}/projects`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all jobs that are being processed or were processed by a specified runner. The list of jobs is limited to projects where the user has the Reporter, Developer, Maintainer, or Owner role.
    *
    * @tags runners, jobs
    * @name GetApiV4RunnersIdJobs
    * @summary List all jobs processed by a runner
    * @request GET:/api/v4/runners/{id}/jobs
    */
    getApiV4RunnersIdJobs: (id, query, params = {}) => this.request({
      path: `/api/v4/runners/${id}/jobs`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Resets the authentication token for a specified runner.
    *
    * @tags runners
    * @name PostApiV4RunnersIdResetAuthenticationToken
    * @summary Reset runner's authentication token
    * @request POST:/api/v4/runners/{id}/reset_authentication_token
    */
    postApiV4RunnersIdResetAuthenticationToken: (id, params = {}) => this.request({
      path: `/api/v4/runners/${id}/reset_authentication_token`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Resets the runner registration token for the GitLab instance.
    *
    * @tags runners, groups
    * @name PostApiV4RunnersResetRegistrationToken
    * @summary Reset the runner registration token for the instance
    * @request POST:/api/v4/runners/reset_registration_token
    */
    postApiV4RunnersResetRegistrationToken: (params = {}) => this.request({
      path: `/api/v4/runners/reset_registration_token`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Requests a job for a runner to execute.
    *
    * @tags jobs
    * @name PostApiV4JobsRequest
    * @summary Request a job
    * @request POST:/api/v4/jobs/request
    */
    postApiV4JobsRequest: (postApiV4JobsRequest, params = {}) => this.request({
      path: `/api/v4/jobs/request`,
      method: "POST",
      body: postApiV4JobsRequest,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Update a job
    *
    * @tags jobs
    * @name PutApiV4JobsId
    * @request PUT:/api/v4/jobs/{id}
    */
    putApiV4JobsId: (id, putApiV4JobsId, params = {}) => this.request({
      path: `/api/v4/jobs/${id}`,
      method: "PUT",
      body: putApiV4JobsId,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Append a patch to the job trace
    *
    * @tags jobs
    * @name PatchApiV4JobsIdTrace
    * @request PATCH:/api/v4/jobs/{id}/trace
    */
    patchApiV4JobsIdTrace: (id, patchApiV4JobsIdTrace, params = {}) => this.request({
      path: `/api/v4/jobs/${id}/trace`,
      method: "PATCH",
      body: patchApiV4JobsIdTrace,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Authorizes uploading artifacts for a specified job.
    *
    * @tags jobs
    * @name PostApiV4JobsIdArtifactsAuthorize
    * @summary Authorize artifacts upload
    * @request POST:/api/v4/jobs/{id}/artifacts/authorize
    */
    postApiV4JobsIdArtifactsAuthorize: (id, postApiV4JobsIdArtifactsAuthorize, params = {}) => this.request({
      path: `/api/v4/jobs/${id}/artifacts/authorize`,
      method: "POST",
      body: postApiV4JobsIdArtifactsAuthorize,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Uploads artifacts for a specified job.
    *
    * @tags jobs
    * @name PostApiV4JobsIdArtifacts
    * @summary Upload job artifacts
    * @request POST:/api/v4/jobs/{id}/artifacts
    */
    postApiV4JobsIdArtifacts: (id, postApiV4JobsIdArtifacts, params = {}) => this.request({
      path: `/api/v4/jobs/${id}/artifacts`,
      method: "POST",
      body: postApiV4JobsIdArtifacts,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Downloads artifacts for a specified job.
    *
    * @tags jobs
    * @name GetApiV4JobsIdArtifacts
    * @summary Download job artifacts
    * @request GET:/api/v4/jobs/{id}/artifacts
    */
    getApiV4JobsIdArtifacts: (id, query, params = {}) => this.request({
      path: `/api/v4/jobs/${id}/artifacts`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Retrieves the repository URL templates for requesting individual packages for a group.
    *
    * @tags packages_composer
    * @name GetApiV4GroupIdPackagesComposerPackages
    * @summary Retrieve repository URL templates
    * @request GET:/api/v4/group/{id}/-/packages/composer/packages
    */
    getApiV4GroupIdPackagesComposerPackages: (id, params = {}) => this.request({
      path: `/api/v4/group/${id}/-/packages/composer/packages`,
      method: "GET",
      ...params
    }),
    /**
    * @description Lists all repository packages for a specified group. Composer V2 is recommended over V1.
    *
    * @tags packages_composer
    * @name GetApiV4GroupIdPackagesComposerPSha
    * @summary List all packages for a group
    * @request GET:/api/v4/group/{id}/-/packages/composer/p/{sha}
    */
    getApiV4GroupIdPackagesComposerPSha: (id, sha, params = {}) => this.request({
      path: `/api/v4/group/${id}/-/packages/composer/p/${sha}`,
      method: "GET",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.1
    *
    * @tags packages_composer
    * @name GetApiV4GroupIdPackagesComposerP2PackageName
    * @summary Composer v2 packages p2 endpoint at group level for package versions metadata
    * @request GET:/api/v4/group/{id}/-/packages/composer/p2/*package_name
    */
    getApiV4GroupIdPackagesComposerP2PackageName: (id, query, params = {}) => this.request({
      path: `/api/v4/group/${id}/-/packages/composer/p2/*package_name`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.1
    *
    * @tags packages_composer
    * @name GetApiV4GroupIdPackagesComposerPackageName
    * @summary Composer packages endpoint at group level for package versions metadata
    * @request GET:/api/v4/group/{id}/-/packages/composer/*package_name
    */
    getApiV4GroupIdPackagesComposerPackageName: (id, query, params = {}) => this.request({
      path: `/api/v4/group/${id}/-/packages/composer/*package_name`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Retrieves an authentication token. Creates a JSON Web Token (JWT) for use as a Bearer header in other requests to the package registry.
    *
    * @tags packages_conan
    * @name GetApiV4PackagesConanV1UsersAuthenticate
    * @summary Retrieve an authentication token
    * @request GET:/api/v4/packages/conan/v1/users/authenticate
    */
    getApiV4PackagesConanV1UsersAuthenticate: (params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/users/authenticate`,
      method: "GET",
      ...params
    }),
    /**
    * @description Verifies authentication credentials for a Conan package registry.
    *
    * @tags packages_conan
    * @name GetApiV4PackagesConanV1UsersCheckCredentials
    * @summary Verify authentication credentials
    * @request GET:/api/v4/packages/conan/v1/users/check_credentials
    */
    getApiV4PackagesConanV1UsersCheckCredentials: (params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/users/check_credentials`,
      method: "GET",
      ...params
    }),
    /**
    * @description Searches the instance for a specified Conan package.
    *
    * @tags packages_conan
    * @name GetApiV4PackagesConanV1ConansSearch
    * @summary Search for a Conan package
    * @request GET:/api/v4/packages/conan/v1/conans/search
    */
    getApiV4PackagesConanV1ConansSearch: (query, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/conans/search`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Retrieves the metadata for all package references of a specified package. This feature was introduced in GitLab 18.0.
    *
    * @tags packages_conan
    * @name GetApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelSearch
    * @summary Retrieve package references metadata
    * @request GET:/api/v4/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/search
    */
    getApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelSearch: (packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/search`,
      method: "GET",
      ...params
    }),
    /**
    * @description Verifies availability of a Conan repository.
    *
    * @tags packages_conan
    * @name GetApiV4PackagesConanV1Ping
    * @summary Verify availability of a Conan repository
    * @request GET:/api/v4/packages/conan/v1/ping
    */
    getApiV4PackagesConanV1Ping: (params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/ping`,
      method: "GET",
      ...params
    }),
    /**
    * @description Retrieves a snapshot of the files for a specified Conan package and reference. The snapshot is a list of filenames with their associated MD5 hash.
    *
    * @tags packages_conan
    * @name GetApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReference
    * @summary Retrieve a package snapshot
    * @request GET:/api/v4/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/packages/{conan_package_reference}
    */
    getApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReference: (packageName, packageVersion, packageUsername, packageChannel, conanPackageReference, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/packages/${conanPackageReference}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a snapshot of the files for a specified Conan recipe. The snapshot is a list of filenames with their associated MD5 hash.
    *
    * @tags packages_conan
    * @name GetApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannel
    * @summary Retrieve a recipe snapshot
    * @request GET:/api/v4/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}
    */
    getApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannel: (packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified Conan recipe and associated package files from the package registry.
    *
    * @tags packages_conan
    * @name DeleteApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannel
    * @summary Delete a recipe and package
    * @request DELETE:/api/v4/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}
    */
    deleteApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannel: (packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Retrieves a manifest that includes a list of files and associated download URLs for a specified package.
    *
    * @tags packages_conan
    * @name GetApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReferenceDigest
    * @summary Retrieve a package manifest
    * @request GET:/api/v4/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/packages/{conan_package_reference}/digest
    */
    getApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReferenceDigest: (packageName, packageVersion, packageUsername, packageChannel, conanPackageReference, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/packages/${conanPackageReference}/digest`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a manifest that includes a list of files and associated download URLs for a specified recipe.
    *
    * @tags packages_conan
    * @name GetApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelDigest
    * @summary Retrieve a recipe manifest
    * @request GET:/api/v4/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/digest
    */
    getApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelDigest: (packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/digest`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all files and associated download URLs for a specified package in the package registry. Returns the same payload as the package manifest endpoint.
    *
    * @tags packages_conan
    * @name GetApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReferenceDownloadUrls
    * @summary List all package download URLs
    * @request GET:/api/v4/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/packages/{conan_package_reference}/download_urls
    */
    getApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReferenceDownloadUrls: (packageName, packageVersion, packageUsername, packageChannel, conanPackageReference, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/packages/${conanPackageReference}/download_urls`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all files and associated download URLs for a specified recipe in the package registry. Returns the same payload as the recipe manifest endpoint.
    *
    * @tags packages_conan
    * @name GetApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelDownloadUrls
    * @summary List all recipe download URLs
    * @request GET:/api/v4/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/download_urls
    */
    getApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelDownloadUrls: (packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/download_urls`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all the upload URLs for a specified collection of package files. The request must include a JSON object with the name and size of the individual files.
    *
    * @tags packages_conan
    * @name PostApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReferenceUploadUrls
    * @summary List all package upload URLs
    * @request POST:/api/v4/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/packages/{conan_package_reference}/upload_urls
    */
    postApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelPackagesConanPackageReferenceUploadUrls: (packageName, packageVersion, packageUsername, packageChannel, conanPackageReference, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/packages/${conanPackageReference}/upload_urls`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all the upload URLs for a specified collection of recipe files. The request must include a JSON object with the name and size of the individual files.
    *
    * @tags packages_conan
    * @name PostApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelUploadUrls
    * @summary List all recipe upload URLs
    * @request POST:/api/v4/packages/conan/v1/conans/{package_name}/{package_version}/{package_username}/{package_channel}/upload_urls
    */
    postApiV4PackagesConanV1ConansPackageNamePackageVersionPackageUsernamePackageChannelUploadUrls: (packageName, packageVersion, packageUsername, packageChannel, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/conans/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/upload_urls`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified recipe file from the package registry. You must use the download URL returned from the recipe download URLs endpoint.
    *
    * @tags packages_conan
    * @name GetApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileName
    * @summary Retrieve a recipe file
    * @request GET:/api/v4/packages/conan/v1/files/{package_name}/{package_version}/{package_username}/{package_channel}/{recipe_revision}/export/{file_name}
    */
    getApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileName: (packageName, packageVersion, packageUsername, packageChannel, recipeRevision, fileName, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/files/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/${recipeRevision}/export/${fileName}`,
      method: "GET",
      ...params
    }),
    /**
    * @description Uploads a specified recipe file to the package registry. You must use the upload URL returned from the recipe upload URLs endpoint.
    *
    * @tags packages_conan
    * @name PutApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileName
    * @summary Upload a recipe file
    * @request PUT:/api/v4/packages/conan/v1/files/{package_name}/{package_version}/{package_username}/{package_channel}/{recipe_revision}/export/{file_name}
    */
    putApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileName: (packageName, packageVersion, packageUsername, packageChannel, recipeRevision, fileName, putApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileName, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/files/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/${recipeRevision}/export/${fileName}`,
      method: "PUT",
      body: putApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileName,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Authorizes the Conan recipe file.
    *
    * @tags packages_conan
    * @name PutApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileNameAuthorize
    * @summary Workhorse authorize the Conan recipe file
    * @request PUT:/api/v4/packages/conan/v1/files/{package_name}/{package_version}/{package_username}/{package_channel}/{recipe_revision}/export/{file_name}/authorize
    */
    putApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionExportFileNameAuthorize: (packageName, packageVersion, packageUsername, packageChannel, recipeRevision, fileName, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/files/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/${recipeRevision}/export/${fileName}/authorize`,
      method: "PUT",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Retrieves a specified package file from the package registry. You must use the download URL returned from the package download URLs endpoint.
    *
    * @tags packages_conan
    * @name GetApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileName
    * @summary Retrieve a package file
    * @request GET:/api/v4/packages/conan/v1/files/{package_name}/{package_version}/{package_username}/{package_channel}/{recipe_revision}/package/{conan_package_reference}/{package_revision}/{file_name}
    */
    getApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileName: (packageName, packageVersion, packageUsername, packageChannel, recipeRevision, conanPackageReference, packageRevision, fileName, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/files/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/${recipeRevision}/package/${conanPackageReference}/${packageRevision}/${fileName}`,
      method: "GET",
      ...params
    }),
    /**
    * @description Uploads a specified package file to the package registry. You must use the upload URL returned from the package upload URLs endpoint.
    *
    * @tags packages_conan
    * @name PutApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileName
    * @summary Upload a package file
    * @request PUT:/api/v4/packages/conan/v1/files/{package_name}/{package_version}/{package_username}/{package_channel}/{recipe_revision}/package/{conan_package_reference}/{package_revision}/{file_name}
    */
    putApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileName: (packageName, packageVersion, packageUsername, packageChannel, recipeRevision, conanPackageReference, packageRevision, fileName, putApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileName, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/files/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/${recipeRevision}/package/${conanPackageReference}/${packageRevision}/${fileName}`,
      method: "PUT",
      body: putApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileName,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Authorizes the Conan package file.
    *
    * @tags packages_conan
    * @name PutApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileNameAuthorize
    * @summary Workhorse authorize the Conan package file
    * @request PUT:/api/v4/packages/conan/v1/files/{package_name}/{package_version}/{package_username}/{package_channel}/{recipe_revision}/package/{conan_package_reference}/{package_revision}/{file_name}/authorize
    */
    putApiV4PackagesConanV1FilesPackageNamePackageVersionPackageUsernamePackageChannelRecipeRevisionPackageConanPackageReferencePackageRevisionFileNameAuthorize: (packageName, packageVersion, packageUsername, packageChannel, recipeRevision, conanPackageReference, packageRevision, fileName, params = {}) => this.request({
      path: `/api/v4/packages/conan/v1/files/${packageName}/${packageVersion}/${packageUsername}/${packageChannel}/${recipeRevision}/package/${conanPackageReference}/${packageRevision}/${fileName}/authorize`,
      method: "PUT",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 11.6
    *
    * @tags packages
    * @name GetApiV4PackagesMavenPathFileName
    * @summary Download the maven package file at instance level
    * @request GET:/api/v4/packages/maven/*path/{file_name}
    */
    getApiV4PackagesMavenPathFileName: (fileName, query, params = {}) => this.request({
      path: `/api/v4/packages/maven/*path/${fileName}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.7
    *
    * @tags packages_npm
    * @name GetApiV4PackagesNpmPackagePackageNameDistTags
    * @summary Get all tags for a given an NPM package
    * @request GET:/api/v4/packages/npm/-/package/*package_name/dist-tags
    */
    getApiV4PackagesNpmPackagePackageNameDistTags: (query, params = {}) => this.request({
      path: `/api/v4/packages/npm/-/package/*package_name/dist-tags`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.7
    *
    * @tags packages_npm
    * @name PutApiV4PackagesNpmPackagePackageNameDistTagsTag
    * @summary Create or Update the given tag for the given NPM package and version
    * @request PUT:/api/v4/packages/npm/-/package/*package_name/dist-tags/{tag}
    */
    putApiV4PackagesNpmPackagePackageNameDistTagsTag: (tag, putApiV4PackagesNpmPackagepackageNameDistTagsTag, params = {}) => this.request({
      path: `/api/v4/packages/npm/-/package/*package_name/dist-tags/${tag}`,
      method: "PUT",
      body: putApiV4PackagesNpmPackagepackageNameDistTagsTag,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.7
    *
    * @tags packages_npm
    * @name DeleteApiV4PackagesNpmPackagePackageNameDistTagsTag
    * @summary Deletes the given tag
    * @request DELETE:/api/v4/packages/npm/-/package/*package_name/dist-tags/{tag}
    */
    deleteApiV4PackagesNpmPackagePackageNameDistTagsTag: (tag, query, params = {}) => this.request({
      path: `/api/v4/packages/npm/-/package/*package_name/dist-tags/${tag}`,
      method: "DELETE",
      query,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.6
    *
    * @tags packages_npm
    * @name PostApiV4PackagesNpmNpmV1SecurityAdvisoriesBulk
    * @summary NPM registry bulk advisory endpoint
    * @request POST:/api/v4/packages/npm/-/npm/v1/security/advisories/bulk
    */
    postApiV4PackagesNpmNpmV1SecurityAdvisoriesBulk: (params = {}) => this.request({
      path: `/api/v4/packages/npm/-/npm/v1/security/advisories/bulk`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 15.6
    *
    * @tags packages_npm
    * @name PostApiV4PackagesNpmNpmV1SecurityAuditsQuick
    * @summary NPM registry quick audit endpoint
    * @request POST:/api/v4/packages/npm/-/npm/v1/security/audits/quick
    */
    postApiV4PackagesNpmNpmV1SecurityAuditsQuick: (params = {}) => this.request({
      path: `/api/v4/packages/npm/-/npm/v1/security/audits/quick`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 11.8
    *
    * @tags packages_npm
    * @name GetApiV4PackagesNpmPackageName
    * @summary NPM registry metadata endpoint
    * @request GET:/api/v4/packages/npm/*package_name
    */
    getApiV4PackagesNpmPackageName: (query, params = {}) => this.request({
      path: `/api/v4/packages/npm/*package_name`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all available versions for a specified module.
    *
    * @tags terraform
    * @name GetApiV4PackagesTerraformModulesV1ModuleNamespaceModuleNameModuleSystemVersions
    * @summary List all available versions for a module
    * @request GET:/api/v4/packages/terraform/modules/v1/{module_namespace}/{module_name}/{module_system}/versions
    */
    getApiV4PackagesTerraformModulesV1ModuleNamespaceModuleNameModuleSystemVersions: (moduleNamespace, moduleName, moduleSystem, params = {}) => this.request({
      path: `/api/v4/packages/terraform/modules/v1/${moduleNamespace}/${moduleName}/${moduleSystem}/versions`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves download URL for latest module version.
    *
    * @tags terraform
    * @name GetApiV4PackagesTerraformModulesV1ModuleNamespaceModuleNameModuleSystemDownload
    * @summary Retrieve download URL for latest module version
    * @request GET:/api/v4/packages/terraform/modules/v1/{module_namespace}/{module_name}/{module_system}/download
    */
    getApiV4PackagesTerraformModulesV1ModuleNamespaceModuleNameModuleSystemDownload: (moduleNamespace, moduleName, moduleSystem, params = {}) => this.request({
      path: `/api/v4/packages/terraform/modules/v1/${moduleNamespace}/${moduleName}/${moduleSystem}/download`,
      method: "GET",
      ...params
    }),
    /**
    * @description Retrieves latest version for a specified module.
    *
    * @tags terraform
    * @name GetApiV4PackagesTerraformModulesV1ModuleNamespaceModuleNameModuleSystem
    * @summary Retrieve latest version for a module
    * @request GET:/api/v4/packages/terraform/modules/v1/{module_namespace}/{module_name}/{module_system}
    */
    getApiV4PackagesTerraformModulesV1ModuleNamespaceModuleNameModuleSystem: (moduleNamespace, moduleName, moduleSystem, params = {}) => this.request({
      path: `/api/v4/packages/terraform/modules/v1/${moduleNamespace}/${moduleName}/${moduleSystem}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Download specific version of a module
    *
    * @tags terraform
    * @name GetApiV4PackagesTerraformModulesV1ModuleNamespaceModuleNameModuleSystemModuleVersionDownload
    * @summary Get download location for specific version of a module
    * @request GET:/api/v4/packages/terraform/modules/v1/{module_namespace}/{module_name}/{module_system}/*module_version/download
    */
    getApiV4PackagesTerraformModulesV1ModuleNamespaceModuleNameModuleSystemModuleVersionDownload: (moduleNamespace, moduleName, moduleSystem, query, params = {}) => this.request({
      path: `/api/v4/packages/terraform/modules/v1/${moduleNamespace}/${moduleName}/${moduleSystem}/*module_version/download`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Download specific version of a module
    *
    * @tags terraform
    * @name GetApiV4PackagesTerraformModulesV1ModuleNamespaceModuleNameModuleSystemModuleVersionFile
    * @summary Download specific version of a module
    * @request GET:/api/v4/packages/terraform/modules/v1/{module_namespace}/{module_name}/{module_system}/*module_version/file
    */
    getApiV4PackagesTerraformModulesV1ModuleNamespaceModuleNameModuleSystemModuleVersionFile: (moduleNamespace, moduleName, moduleSystem, query, params = {}) => this.request({
      path: `/api/v4/packages/terraform/modules/v1/${moduleNamespace}/${moduleName}/${moduleSystem}/*module_version/file`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Get details about specific version of a module
    *
    * @tags terraform
    * @name GetApiV4PackagesTerraformModulesV1ModuleNamespaceModuleNameModuleSystemModuleVersion
    * @summary Get details about specific version of a module
    * @request GET:/api/v4/packages/terraform/modules/v1/{module_namespace}/{module_name}/{module_system}/*module_version
    */
    getApiV4PackagesTerraformModulesV1ModuleNamespaceModuleNameModuleSystemModuleVersion: (moduleNamespace, moduleName, moduleSystem, query, params = {}) => this.request({
      path: `/api/v4/packages/terraform/modules/v1/${moduleNamespace}/${moduleName}/${moduleSystem}/*module_version`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 12.10
    *
    * @tags container_registry
    * @name PostApiV4ContainerRegistryEventEvents
    * @summary Receives notifications from the container registry when an operation occurs
    * @request POST:/api/v4/container_registry_event/events
    */
    postApiV4ContainerRegistryEventEvents: (params = {}) => this.request({
      path: `/api/v4/container_registry_event/events`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Retrieves details of a specified container registry repository.
    *
    * @tags container_registry
    * @name GetApiV4RegistryRepositoriesId
    * @summary Retrieve details of a container registry repository
    * @request GET:/api/v4/registry/repositories/{id}
    */
    getApiV4RegistryRepositoriesId: (id, query, params = {}) => this.request({
      path: `/api/v4/registry/repositories/${id}`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Returns database dictionary tables filtered by database and optional table size
    *
    * @tags database_dictionary
    * @name GetApiV4DatabasesDatabaseNameDictionaryTables
    * @summary List dictionary tables
    * @request GET:/api/v4/databases/{database_name}/dictionary/tables
    */
    getApiV4DatabasesDatabaseNameDictionaryTables: (databaseName, query, params = {}) => this.request({
      path: `/api/v4/databases/${databaseName}/dictionary/tables`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all events for the authenticated user. Does not return events associated with epics or merge requests. Returns bulk push events with limited commit details.
    *
    * @tags events
    * @name GetApiV4Events
    * @summary List all events
    * @request GET:/api/v4/events
    */
    getApiV4Events: (query, params = {}) => this.request({
      path: `/api/v4/events`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the contribution events for a specified user. Does not return events associated with epics or merge requests. Returns bulk push events with limited commit details.
    *
    * @tags events
    * @name GetApiV4UsersIdEvents
    * @summary Retrieve contribution events for a user
    * @request GET:/api/v4/users/{id}/events
    */
    getApiV4UsersIdEvents: (id, query, params = {}) => this.request({
      path: `/api/v4/users/${id}/events`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all personal projects for a specified user. Does not return group or subgroup projects. If the user profile is private, returns only an empty list.
    *
    * @tags projects
    * @name GetApiV4UsersUserIdProjects
    * @summary List all personal projects for a user
    * @request GET:/api/v4/users/{user_id}/projects
    */
    getApiV4UsersUserIdProjects: (userId, query, params = {}) => this.request({
      path: `/api/v4/users/${userId}/projects`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all contributions to visible projects for a specified user. Returns only contributions in the past year.
    *
    * @tags projects
    * @name GetApiV4UsersUserIdContributedProjects
    * @summary List all projects contributions for a user
    * @request GET:/api/v4/users/{user_id}/contributed_projects
    */
    getApiV4UsersUserIdContributedProjects: (userId, query, params = {}) => this.request({
      path: `/api/v4/users/${userId}/contributed_projects`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all visible projects starred by a specified user. Unauthenticated requests return only public projects.
    *
    * @tags projects
    * @name GetApiV4UsersUserIdStarredProjects
    * @summary List all projects starred by a user
    * @request GET:/api/v4/users/{user_id}/starred_projects
    */
    getApiV4UsersUserIdStarredProjects: (userId, query, params = {}) => this.request({
      path: `/api/v4/users/${userId}/starred_projects`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all feature flags for the instance.
    *
    * @tags features
    * @name GetApiV4Features
    * @summary List all feature flags
    * @request GET:/api/v4/features
    */
    getApiV4Features: (params = {}) => this.request({
      path: `/api/v4/features`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all feature flag definitions.
    *
    * @tags features
    * @name GetApiV4FeaturesDefinitions
    * @summary List all feature flag definitions
    * @request GET:/api/v4/features/definitions
    */
    getApiV4FeaturesDefinitions: (params = {}) => this.request({
      path: `/api/v4/features/definitions`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates or updates a feature flag value. If a feature with the given name doesn't exist yet, the operation creates one. The value can be a boolean or an integer to indicate percentage of time.
    *
    * @tags features
    * @name PostApiV4FeaturesName
    * @summary Create or update a feature flag
    * @request POST:/api/v4/features/{name}
    */
    postApiV4FeaturesName: (name, postApiV4FeaturesName, params = {}) => this.request({
      path: `/api/v4/features/${name}`,
      method: "POST",
      body: postApiV4FeaturesName,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a feature gate. Returns the same response if the feature gate does not exist.
    *
    * @tags features
    * @name DeleteApiV4FeaturesName
    * @summary Delete a feature
    * @request DELETE:/api/v4/features/{name}
    */
    deleteApiV4FeaturesName: (name, params = {}) => this.request({
      path: `/api/v4/features/${name}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Returns a Geo proxy response
    *
    * @tags geo
    * @name GetApiV4GeoProxy
    * @summary Determine if a Geo site should proxy requests
    * @request GET:/api/v4/geo/proxy
    */
    getApiV4GeoProxy: (params = {}) => this.request({
      path: `/api/v4/geo/proxy`,
      method: "GET",
      ...params
    }),
    /**
    * @description Returns a replicable file from store (via CDN or sendfile)
    *
    * @tags geo
    * @name GetApiV4GeoRetrieveReplicableNameReplicableId
    * @summary Internal endpoint that returns a replicable file
    * @request GET:/api/v4/geo/retrieve/{replicable_name}/{replicable_id}
    */
    getApiV4GeoRetrieveReplicableNameReplicableId: (replicableName, replicableId, params = {}) => this.request({
      path: `/api/v4/geo/retrieve/${replicableName}/${replicableId}`,
      method: "GET",
      ...params
    }),
    /**
    * @description Returns the list of pipeline refs for the project
    *
    * @tags geo
    * @name GetApiV4GeoRepositoriesGlRepositoryPipelineRefs
    * @summary Used by secondary runners to verify the secondary instance has the very latest version
    * @request GET:/api/v4/geo/repositories/{gl_repository}/pipeline_refs
    */
    getApiV4GeoRepositoriesGlRepositoryPipelineRefs: (glRepository, params = {}) => this.request({
      path: `/api/v4/geo/repositories/${glRepository}/pipeline_refs`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Posts the current node status to the primary site
    *
    * @tags geo
    * @name PostApiV4GeoStatus
    * @summary Internal endpoint that posts the current node status
    * @request POST:/api/v4/geo/status
    */
    postApiV4GeoStatus: (postApiV4GeoStatus, params = {}) => this.request({
      path: `/api/v4/geo/status`,
      method: "POST",
      body: postApiV4GeoStatus,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Reports resources that persistently fail verification on a secondary
    *
    * @tags geo
    * @name PostApiV4GeoFailures
    * @summary Internal endpoint that reports persistent verification failures to the primary
    * @request POST:/api/v4/geo/failures
    */
    postApiV4GeoFailures: (postApiV4GeoFailures, params = {}) => this.request({
      path: `/api/v4/geo/failures`,
      method: "POST",
      body: postApiV4GeoFailures,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Responsible for making HTTP GET /repo.git/info/refs?service=git-upload-pack request from secondary gitlab-shell to primary
    *
    * @tags geo
    * @name PostApiV4GeoProxyGitSshInfoRefsUploadPack
    * @summary Internal endpoint that returns info refs upload pack for clone or pull operations
    * @request POST:/api/v4/geo/proxy_git_ssh/info_refs_upload_pack
    */
    postApiV4GeoProxyGitSshInfoRefsUploadPack: (postApiV4GeoProxyGitSshInfoRefsUploadPack, params = {}) => this.request({
      path: `/api/v4/geo/proxy_git_ssh/info_refs_upload_pack`,
      method: "POST",
      body: postApiV4GeoProxyGitSshInfoRefsUploadPack,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Responsible for making HTTP POST /repo.git/git-upload-pack request from secondary gitlab-shell to primary
    *
    * @tags geo
    * @name PostApiV4GeoProxyGitSshUploadPack
    * @summary Internal endpoint that posts git-upload-pack for clone or pull operations
    * @request POST:/api/v4/geo/proxy_git_ssh/upload_pack
    */
    postApiV4GeoProxyGitSshUploadPack: (postApiV4GeoProxyGitSshUploadPack, params = {}) => this.request({
      path: `/api/v4/geo/proxy_git_ssh/upload_pack`,
      method: "POST",
      body: postApiV4GeoProxyGitSshUploadPack,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Responsible for making HTTP GET /repo.git/info/refs?service=git-receive-pack request from secondary gitlab-shell to primary
    *
    * @tags geo
    * @name PostApiV4GeoProxyGitSshInfoRefsReceivePack
    * @summary Internal endpoint that returns git-received-pack output for git push
    * @request POST:/api/v4/geo/proxy_git_ssh/info_refs_receive_pack
    */
    postApiV4GeoProxyGitSshInfoRefsReceivePack: (postApiV4GeoProxyGitSshInfoRefsReceivePack, params = {}) => this.request({
      path: `/api/v4/geo/proxy_git_ssh/info_refs_receive_pack`,
      method: "POST",
      body: postApiV4GeoProxyGitSshInfoRefsReceivePack,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Responsible for making HTTP POST /repo.git/info/refs?service=git-receive-pack request from secondary gitlab-shell to primary
    *
    * @tags geo
    * @name PostApiV4GeoProxyGitSshReceivePack
    * @summary Internal endpoint that posts git-receive-pack for git push
    * @request POST:/api/v4/geo/proxy_git_ssh/receive_pack
    */
    postApiV4GeoProxyGitSshReceivePack: (postApiV4GeoProxyGitSshReceivePack, params = {}) => this.request({
      path: `/api/v4/geo/proxy_git_ssh/receive_pack`,
      method: "POST",
      body: postApiV4GeoProxyGitSshReceivePack,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Query the GraphQL endpoint of an existing Geo node
    *
    * @tags geo
    * @name PostApiV4GeoNodeProxyIdGraphql
    * @summary Query the GraphQL endpoint of an existing Geo node
    * @request POST:/api/v4/geo/node_proxy/{id}/graphql
    */
    postApiV4GeoNodeProxyIdGraphql: (id, params = {}) => this.request({
      path: `/api/v4/geo/node_proxy/${id}/graphql`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Executes a GLQL query to search and filter GitLab resources.
    *
    * @tags glql
    * @name PostApiV4Glql
    * @summary Execute a GLQL query
    * @request POST:/api/v4/glql
    */
    postApiV4Glql: (postApiV4Glql, params = {}) => this.request({
      path: `/api/v4/glql`,
      method: "POST",
      body: postApiV4Glql,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Receive Slack events
    *
    * @tags integrations
    * @name PostApiV4IntegrationsSlackEvents
    * @request POST:/api/v4/integrations/slack/events
    */
    postApiV4IntegrationsSlackEvents: (postApiV4IntegrationsSlackEvents, params = {}) => this.request({
      path: `/api/v4/integrations/slack/events`,
      method: "POST",
      body: postApiV4IntegrationsSlackEvents,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Processes interaction events from Slack
    *
    * @tags integrations, internal_operations
    * @name PostApiV4IntegrationsSlackInteractions
    * @summary Process Slack interaction events
    * @request POST:/api/v4/integrations/slack/interactions
    */
    postApiV4IntegrationsSlackInteractions: (params = {}) => this.request({
      path: `/api/v4/integrations/slack/interactions`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Retrieves options for Slack interactive components
    *
    * @tags integrations, internal_operations
    * @name PostApiV4IntegrationsSlackOptions
    * @summary Get Slack interactive component options
    * @request POST:/api/v4/integrations/slack/options
    */
    postApiV4IntegrationsSlackOptions: (params = {}) => this.request({
      path: `/api/v4/integrations/slack/options`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Subscribes the namespace to the JiraConnectInstallation
    *
    * @tags jira_connect_subscriptions
    * @name PostApiV4IntegrationsJiraConnectSubscriptions
    * @summary Subscribe a namespace to a JiraConnectInstallation
    * @request POST:/api/v4/integrations/jira_connect/subscriptions
    */
    postApiV4IntegrationsJiraConnectSubscriptions: (postApiV4IntegrationsJiraConnectSubscriptions, params = {}) => this.request({
      path: `/api/v4/integrations/jira_connect/subscriptions`,
      method: "POST",
      body: postApiV4IntegrationsJiraConnectSubscriptions,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Sets the GitLab instance the installation points at. Omit instance_url (or send null) for GitLab.com. Requires a Jira site or organization admin.
    *
    * @tags jira_forge_installation
    * @name PutApiV4IntegrationsJiraForgeInstallation
    * @summary Update the GitLab for Jira (Forge) installation instance URL
    * @request PUT:/api/v4/integrations/jira_forge/installation
    */
    putApiV4IntegrationsJiraForgeInstallation: (putApiV4IntegrationsJiraForgeInstallation, params = {}) => this.request({
      path: `/api/v4/integrations/jira_forge/installation`,
      method: "PUT",
      body: putApiV4IntegrationsJiraForgeInstallation,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Stores the Forge app system OAuth token (X-Forge-Oauth-System header) and the Jira apiBaseUrl (from the FIT), so GitLab pushes dev-info directly to Jira. See Atlassian::Forge::SystemTokenClient.
    *
    * @tags jira_forge_installation
    * @name PostApiV4IntegrationsJiraForgeInstallationForgeToken
    * @summary Register the GitLab for Jira (Forge) system token for direct dev-info sync
    * @request POST:/api/v4/integrations/jira_forge/installation/forge_token
    */
    postApiV4IntegrationsJiraForgeInstallationForgeToken: (params = {}) => this.request({
      path: `/api/v4/integrations/jira_forge/installation/forge_token`,
      method: "POST",
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Subscribes a GitLab namespace to the Forge installation so its development data syncs to Jira. Authenticated as the GitLab user (OAuth); the Jira installation and user are resolved from the Forge invocation context.
    *
    * @tags jira_forge_subscriptions
    * @name PostApiV4IntegrationsJiraForgeSubscriptions
    * @summary Create a GitLab for Jira (Forge) namespace subscription
    * @request POST:/api/v4/integrations/jira_forge/subscriptions
    */
    postApiV4IntegrationsJiraForgeSubscriptions: (postApiV4IntegrationsJiraForgeSubscriptions, params = {}) => this.request({
      path: `/api/v4/integrations/jira_forge/subscriptions`,
      method: "POST",
      body: postApiV4IntegrationsJiraForgeSubscriptions,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists the GitLab namespaces subscribed to the Forge installation.
    *
    * @tags jira_forge_subscriptions
    * @name GetApiV4IntegrationsJiraForgeSubscriptions
    * @summary List GitLab for Jira (Forge) namespace subscriptions
    * @request GET:/api/v4/integrations/jira_forge/subscriptions
    */
    getApiV4IntegrationsJiraForgeSubscriptions: (params = {}) => this.request({
      path: `/api/v4/integrations/jira_forge/subscriptions`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Unsubscribes a GitLab namespace from the Forge installation.
    *
    * @tags jira_forge_subscriptions
    * @name DeleteApiV4IntegrationsJiraForgeSubscriptionsId
    * @summary Delete a GitLab for Jira (Forge) namespace subscription
    * @request DELETE:/api/v4/integrations/jira_forge/subscriptions/{id}
    */
    deleteApiV4IntegrationsJiraForgeSubscriptionsId: (id, params = {}) => this.request({
      path: `/api/v4/integrations/jira_forge/subscriptions/${id}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all issues accessible by the currently authenticated user. By default, returns only issues created by the current user. To list all issues, use parameter `scope=all`.
    *
    * @tags issues
    * @name GetApiV4Issues
    * @summary List all issues for the currently authenticated user
    * @request GET:/api/v4/issues
    */
    getApiV4Issues: (query, params = {}) => this.request({
      path: `/api/v4/issues`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified issue. Administrators only.
    *
    * @tags issues
    * @name GetApiV4IssuesId
    * @summary Retrieve an issue
    * @request GET:/api/v4/issues/{id}
    */
    getApiV4IssuesId: (id, params = {}) => this.request({
      path: `/api/v4/issues/${id}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves user by SSH key ID. Administrators only.
    *
    * @tags keys
    * @name GetApiV4KeysId
    * @summary Retrieve user by SSH key ID
    * @request GET:/api/v4/keys/{id}
    */
    getApiV4KeysId: (id, params = {}) => this.request({
      path: `/api/v4/keys/${id}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves user by SSH key fingerprint. Administrators only.
    *
    * @tags keys
    * @name GetApiV4Keys
    * @summary Retrieve user by SSH key fingerprint
    * @request GET:/api/v4/keys
    */
    getApiV4Keys: (query, params = {}) => this.request({
      path: `/api/v4/keys`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Renders Markdown content as HTML.
    *
    * @tags markdown
    * @name PostApiV4Markdown
    * @summary Render Markdown content
    * @request POST:/api/v4/markdown
    */
    postApiV4Markdown: (postApiV4Markdown, params = {}) => this.request({
      path: `/api/v4/markdown`,
      method: "POST",
      body: postApiV4Markdown,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all merge requests accessible to the authenticated user. By default, returns only merge requests created by the current user. Use `scope=all` to get all merge requests.
    *
    * @tags merge_requests
    * @name GetApiV4MergeRequests
    * @summary List all merge requests
    * @request GET:/api/v4/merge_requests
    */
    getApiV4MergeRequests: (query, params = {}) => this.request({
      path: `/api/v4/merge_requests`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Deprecated in 17.8
    *
    * @tags namespaces
    * @name PutApiV4NamespacesId
    * @summary Update a namespace
    * @request PUT:/api/v4/namespaces/{id}
    */
    putApiV4NamespacesId: (id, putApiV4NamespacesId, params = {}) => this.request({
      path: `/api/v4/namespaces/${id}`,
      method: "PUT",
      body: putApiV4NamespacesId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified namespace.
    *
    * @tags namespaces
    * @name GetApiV4NamespacesId
    * @summary Retrieve namespace details
    * @request GET:/api/v4/namespaces/{id}
    */
    getApiV4NamespacesId: (id, params = {}) => this.request({
      path: `/api/v4/namespaces/${id}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves GitLab subscription details for a specified namespace.
    *
    * @tags namespaces
    * @name GetApiV4NamespacesIdGitlabSubscription
    * @summary Retrieve namespace subscription
    * @request GET:/api/v4/namespaces/{id}/gitlab_subscription
    */
    getApiV4NamespacesIdGitlabSubscription: (id, params = {}) => this.request({
      path: `/api/v4/namespaces/${id}/gitlab_subscription`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Creates a Namespaces::Storage::LimitExclusion
    *
    * @tags namespaces
    * @name PostApiV4NamespacesIdStorageLimitExclusion
    * @summary Creates a storage limit exclusion for a Namespace
    * @request POST:/api/v4/namespaces/{id}/storage/limit_exclusion
    */
    postApiV4NamespacesIdStorageLimitExclusion: (id, postApiV4NamespacesIdStorageLimitExclusion, params = {}) => this.request({
      path: `/api/v4/namespaces/${id}/storage/limit_exclusion`,
      method: "POST",
      body: postApiV4NamespacesIdStorageLimitExclusion,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Removes a Namespaces::Storage::LimitExclusion
    *
    * @tags namespaces
    * @name DeleteApiV4NamespacesIdStorageLimitExclusion
    * @summary Removes a storage limit exclusion for a Namespace
    * @request DELETE:/api/v4/namespaces/{id}/storage/limit_exclusion
    */
    deleteApiV4NamespacesIdStorageLimitExclusion: (id, params = {}) => this.request({
      path: `/api/v4/namespaces/${id}/storage/limit_exclusion`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Gets all records for namespaces that have been excluded
    *
    * @tags namespaces
    * @name GetApiV4NamespacesStorageLimitExclusions
    * @summary Retrieve all limit exclusions
    * @request GET:/api/v4/namespaces/storage/limit_exclusions
    */
    getApiV4NamespacesStorageLimitExclusions: (query, params = {}) => this.request({
      path: `/api/v4/namespaces/storage/limit_exclusions`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all namespaces available to the current user. If the user is an administrator, this endpoint returns all namespaces in the instance.
    *
    * @tags namespaces
    * @name GetApiV4Namespaces
    * @summary List all namespaces
    * @request GET:/api/v4/namespaces
    */
    getApiV4Namespaces: (query, params = {}) => this.request({
      path: `/api/v4/namespaces`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Verifies that a namespace is available for use.
    *
    * @tags namespaces
    * @name GetApiV4NamespacesIdExists
    * @summary Verify namespace availability
    * @request GET:/api/v4/namespaces/{id}/exists
    */
    getApiV4NamespacesIdExists: (id, query, params = {}) => this.request({
      path: `/api/v4/namespaces/${id}/exists`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Initiates a new offline transfer export. For more information, see https://docs.gitlab.com/user/group/import/offline_transfer_migrations/
    *
    * @tags offline_transfers
    * @name PostApiV4OfflineExports
    * @summary Start a new offline transfer export
    * @request POST:/api/v4/offline_exports
    */
    postApiV4OfflineExports: (postApiV4OfflineExports, params = {}) => this.request({
      path: `/api/v4/offline_exports`,
      method: "POST",
      body: postApiV4OfflineExports,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all offline transfer exports. For more information, see https://docs.gitlab.com/user/group/import/offline_transfer_migrations/
    *
    * @tags offline_transfers
    * @name GetApiV4OfflineExports
    * @summary List all offline transfer exports
    * @request GET:/api/v4/offline_exports
    */
    getApiV4OfflineExports: (query, params = {}) => this.request({
      path: `/api/v4/offline_exports`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Retrieves details of an offline transfer export. For more information, see https://docs.gitlab.com/user/group/import/offline_transfer_migrations/
    *
    * @tags offline_transfers
    * @name GetApiV4OfflineExportsId
    * @summary Get offline transfer export details
    * @request GET:/api/v4/offline_exports/{id}
    */
    getApiV4OfflineExportsId: (id, params = {}) => this.request({
      path: `/api/v4/offline_exports/${id}`,
      method: "GET",
      ...params
    }),
    /**
    * @description Initiates a new offline transfer import from object storage. For more information, see https://docs.gitlab.com/user/group/import/offline_transfer_migrations/
    *
    * @tags offline_transfers
    * @name PostApiV4OfflineImports
    * @summary Start a new offline transfer import
    * @request POST:/api/v4/offline_imports
    */
    postApiV4OfflineImports: (postApiV4OfflineImports, params = {}) => this.request({
      path: `/api/v4/offline_imports`,
      method: "POST",
      body: postApiV4OfflineImports,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates an organization. This feature was introduced in GitLab 17.5. This feature is behind the `allow_organization_creation` feature flag. In GitLab 18.3, the feature flag changed to `organization_switching`.
    *
    * @tags organizations
    * @name PostApiV4Organizations
    * @summary Create an organization
    * @request POST:/api/v4/organizations
    */
    postApiV4Organizations: (postApiV4Organizations, params = {}) => this.request({
      path: `/api/v4/organizations`,
      method: "POST",
      body: postApiV4Organizations,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 19.2.
    *
    * @tags organizations
    * @name DeleteApiV4OrganizationsId
    * @summary Soft-delete an organization
    * @request DELETE:/api/v4/organizations/{id}
    */
    deleteApiV4OrganizationsId: (id, params = {}) => this.request({
      path: `/api/v4/organizations/${id}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all Pages domains on the instance. You must have administrator access to the instance.
    *
    * @tags gitlab_pages
    * @name GetApiV4PagesDomains
    * @summary List all Pages domains
    * @request GET:/api/v4/pages/domains
    */
    getApiV4PagesDomains: (query, params = {}) => this.request({
      path: `/api/v4/pages/domains`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified personal access token by passing it to the API in a header.
    *
    * @tags access_tokens
    * @name GetApiV4PersonalAccessTokensSelf
    * @summary Retrieve a personal access token
    * @request GET:/api/v4/personal_access_tokens/self
    */
    getApiV4PersonalAccessTokensSelf: (params = {}) => this.request({
      path: `/api/v4/personal_access_tokens/self`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Revokes a personal access token by passing it to the API in a header.
    *
    * @tags access_tokens
    * @name DeleteApiV4PersonalAccessTokensSelf
    * @summary Revoke a personal access token
    * @request DELETE:/api/v4/personal_access_tokens/self
    */
    deleteApiV4PersonalAccessTokensSelf: (params = {}) => this.request({
      path: `/api/v4/personal_access_tokens/self`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all groups and projects accessible by the personal access token used to authenticate the request. Generally, this includes any groups or projects that the user is a member of.
    *
    * @tags access_tokens
    * @name GetApiV4PersonalAccessTokensSelfAssociations
    * @summary List all token associations
    * @request GET:/api/v4/personal_access_tokens/self/associations
    */
    getApiV4PersonalAccessTokensSelfAssociations: (query, params = {}) => this.request({
      path: `/api/v4/personal_access_tokens/self/associations`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Rotates a personal access token by passing it to the API in a header
    *
    * @tags access_tokens
    * @name PostApiV4PersonalAccessTokensSelfRotate
    * @summary Rotate a personal access token
    * @request POST:/api/v4/personal_access_tokens/self/rotate
    */
    postApiV4PersonalAccessTokensSelfRotate: (postApiV4PersonalAccessTokensSelfRotate, params = {}) => this.request({
      path: `/api/v4/personal_access_tokens/self/rotate`,
      method: "POST",
      body: postApiV4PersonalAccessTokensSelfRotate,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all personal access tokens accessible by the authenticated user. For administrators, returns all personal access tokens in the instance. For non-administrators, returns all of their personal access tokens.
    *
    * @tags access_tokens
    * @name GetApiV4PersonalAccessTokens
    * @summary List all personal access tokens
    * @request GET:/api/v4/personal_access_tokens
    */
    getApiV4PersonalAccessTokens: (query, params = {}) => this.request({
      path: `/api/v4/personal_access_tokens`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves details for a specified personal access token. Administrators can retrieve details on any token. Non-administrators can only retrieve details on their own tokens.
    *
    * @tags access_tokens
    * @name GetApiV4PersonalAccessTokensId
    * @summary Retrieve a personal access token
    * @request GET:/api/v4/personal_access_tokens/{id}
    */
    getApiV4PersonalAccessTokensId: (id, params = {}) => this.request({
      path: `/api/v4/personal_access_tokens/${id}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Revokes a specified personal access token. Administrators can revoke tokens for any user. Non-administrators can only revoke their own tokens.
    *
    * @tags access_tokens
    * @name DeleteApiV4PersonalAccessTokensId
    * @summary Revoke a personal access token
    * @request DELETE:/api/v4/personal_access_tokens/{id}
    */
    deleteApiV4PersonalAccessTokensId: (id, params = {}) => this.request({
      path: `/api/v4/personal_access_tokens/${id}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Rotates a specified personal access token. This revokes the previous token and creates a token that expires after one week. Administrators can revoke tokens for any user. Non-administrators can only revoke their own tokens.
    *
    * @tags access_tokens
    * @name PostApiV4PersonalAccessTokensIdRotate
    * @summary Rotate a personal access token
    * @request POST:/api/v4/personal_access_tokens/{id}/rotate
    */
    postApiV4PersonalAccessTokensIdRotate: (id, postApiV4PersonalAccessTokensIdRotate, params = {}) => this.request({
      path: `/api/v4/personal_access_tokens/${id}/rotate`,
      method: "POST",
      body: postApiV4PersonalAccessTokensIdRotate,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Searches for a term across the entire GitLab instance. The response depends on the requested scope.
    *
    * @tags search
    * @name GetApiV4Search
    * @summary Search an instance
    * @request GET:/api/v4/search
    */
    getApiV4Search: (query, params = {}) => this.request({
      path: `/api/v4/search`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Lists all snippets for the currently authenticated user.
    *
    * @tags snippets
    * @name GetApiV4Snippets
    * @summary List all snippets for current user
    * @request GET:/api/v4/snippets
    */
    getApiV4Snippets: (query, params = {}) => this.request({
      path: `/api/v4/snippets`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a snippet.
    *
    * @tags snippets
    * @name PostApiV4Snippets
    * @summary Create a snippet
    * @request POST:/api/v4/snippets
    */
    postApiV4Snippets: (postApiV4Snippets, params = {}) => this.request({
      path: `/api/v4/snippets`,
      method: "POST",
      body: postApiV4Snippets,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all public snippets accessible to the currently authenticated user.
    *
    * @tags snippets
    * @name GetApiV4SnippetsPublic
    * @summary List all public snippets
    * @request GET:/api/v4/snippets/public
    */
    getApiV4SnippetsPublic: (query, params = {}) => this.request({
      path: `/api/v4/snippets/public`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all snippets available to the currently authenticated user. Users with Administrator or Auditor access levels can see all snippets (both personal and project). This feature was introduced in GitLab 16.3.
    *
    * @tags snippets
    * @name GetApiV4SnippetsAll
    * @summary List all snippets
    * @request GET:/api/v4/snippets/all
    */
    getApiV4SnippetsAll: (query, params = {}) => this.request({
      path: `/api/v4/snippets/all`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified snippet.
    *
    * @tags snippets
    * @name GetApiV4SnippetsId
    * @summary Retrieve a snippet
    * @request GET:/api/v4/snippets/{id}
    */
    getApiV4SnippetsId: (id, params = {}) => this.request({
      path: `/api/v4/snippets/${id}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified snippet.
    *
    * @tags snippets
    * @name PutApiV4SnippetsId
    * @summary Update snippet
    * @request PUT:/api/v4/snippets/{id}
    */
    putApiV4SnippetsId: (id, putApiV4SnippetsId, params = {}) => this.request({
      path: `/api/v4/snippets/${id}`,
      method: "PUT",
      body: putApiV4SnippetsId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified snippet.
    *
    * @tags snippets
    * @name DeleteApiV4SnippetsId
    * @summary Delete snippet
    * @request DELETE:/api/v4/snippets/{id}
    */
    deleteApiV4SnippetsId: (id, params = {}) => this.request({
      path: `/api/v4/snippets/${id}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the raw contents of a specified snippet as plain text
    *
    * @tags snippets
    * @name GetApiV4SnippetsIdRaw
    * @summary Retrieve a raw snippet
    * @request GET:/api/v4/snippets/{id}/raw
    */
    getApiV4SnippetsIdRaw: (id, params = {}) => this.request({
      path: `/api/v4/snippets/${id}/raw`,
      method: "GET",
      ...params
    }),
    /**
    * @description Retrieves the raw file content from a snippet as plain text.
    *
    * @tags snippets
    * @name GetApiV4SnippetsIdFilesRefFilePathRaw
    * @summary Retrieve snippet file content
    * @request GET:/api/v4/snippets/{id}/files/{ref}/{file_path}/raw
    */
    getApiV4SnippetsIdFilesRefFilePathRaw: (ref, filePath, id, params = {}) => this.request({
      path: `/api/v4/snippets/${id}/files/${ref}/${filePath}/raw`,
      method: "GET",
      ...params
    }),
    /**
    * @description Retrieves user agent details for a specified snippet.
    *
    * @tags snippets
    * @name GetApiV4SnippetsIdUserAgentDetail
    * @summary Retrieve user agent details for a snippet
    * @request GET:/api/v4/snippets/{id}/user_agent_detail
    */
    getApiV4SnippetsIdUserAgentDetail: (id, params = {}) => this.request({
      path: `/api/v4/snippets/${id}/user_agent_detail`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Applies a suggested patch in a merge request. You must have the Developer, Maintainer, or Owner role.
    *
    * @tags suggestions
    * @name PutApiV4SuggestionsIdApply
    * @summary Apply a suggestion to a merge request
    * @request PUT:/api/v4/suggestions/{id}/apply
    */
    putApiV4SuggestionsIdApply: (id, putApiV4SuggestionsIdApply, params = {}) => this.request({
      path: `/api/v4/suggestions/${id}/apply`,
      method: "PUT",
      body: putApiV4SuggestionsIdApply,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Applies multiple suggested patches in a merge request. You must have the Developer, Maintainer, or Owner role.
    *
    * @tags suggestions
    * @name PutApiV4SuggestionsBatchApply
    * @summary Apply multiple suggestions to a merge request
    * @request PUT:/api/v4/suggestions/batch_apply
    */
    putApiV4SuggestionsBatchApply: (putApiV4SuggestionsBatchApply, params = {}) => this.request({
      path: `/api/v4/suggestions/batch_apply`,
      method: "PUT",
      body: putApiV4SuggestionsBatchApply,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Updates a URL variable for a specified webhook.
    *
    * @tags hooks
    * @name PutApiV4HooksHookIdUrlVariablesKey
    * @summary Update a URL variable
    * @request PUT:/api/v4/hooks/{hook_id}/url_variables/{key}
    */
    putApiV4HooksHookIdUrlVariablesKey: (hookId, key, putApiV4HooksHookIdUrlVariablesKey, params = {}) => this.request({
      path: `/api/v4/hooks/${hookId}/url_variables/${key}`,
      method: "PUT",
      body: putApiV4HooksHookIdUrlVariablesKey,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Deletes a URL variable from a specified webhook.
    *
    * @tags hooks
    * @name DeleteApiV4HooksHookIdUrlVariablesKey
    * @summary Delete a URL variable
    * @request DELETE:/api/v4/hooks/{hook_id}/url_variables/{key}
    */
    deleteApiV4HooksHookIdUrlVariablesKey: (hookId, key, params = {}) => this.request({
      path: `/api/v4/hooks/${hookId}/url_variables/${key}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Updates a custom header for a specified webhook.
    *
    * @tags hooks
    * @name PutApiV4HooksHookIdCustomHeadersKey
    * @summary Update a custom header
    * @request PUT:/api/v4/hooks/{hook_id}/custom_headers/{key}
    */
    putApiV4HooksHookIdCustomHeadersKey: (hookId, key, putApiV4HooksHookIdCustomHeadersKey, params = {}) => this.request({
      path: `/api/v4/hooks/${hookId}/custom_headers/${key}`,
      method: "PUT",
      body: putApiV4HooksHookIdCustomHeadersKey,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Deletes a custom header from a specified webhook.
    *
    * @tags hooks
    * @name DeleteApiV4HooksHookIdCustomHeadersKey
    * @summary Delete a custom header
    * @request DELETE:/api/v4/hooks/{hook_id}/custom_headers/{key}
    */
    deleteApiV4HooksHookIdCustomHeadersKey: (hookId, key, params = {}) => this.request({
      path: `/api/v4/hooks/${hookId}/custom_headers/${key}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Lists all system hooks for the instance.
    *
    * @tags hooks
    * @name GetApiV4Hooks
    * @summary List all system hooks
    * @request GET:/api/v4/hooks
    */
    getApiV4Hooks: (query, params = {}) => this.request({
      path: `/api/v4/hooks`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a system hook.
    *
    * @tags hooks
    * @name PostApiV4Hooks
    * @summary Create a system hook
    * @request POST:/api/v4/hooks
    */
    postApiV4Hooks: (postApiV4Hooks, params = {}) => this.request({
      path: `/api/v4/hooks`,
      method: "POST",
      body: postApiV4Hooks,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified system hook.
    *
    * @tags hooks
    * @name GetApiV4HooksHookId
    * @summary Retrieve a system hook
    * @request GET:/api/v4/hooks/{hook_id}
    */
    getApiV4HooksHookId: (hookId, params = {}) => this.request({
      path: `/api/v4/hooks/${hookId}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified system hook.
    *
    * @tags hooks
    * @name PutApiV4HooksHookId
    * @summary Update a system hook
    * @request PUT:/api/v4/hooks/{hook_id}
    */
    putApiV4HooksHookId: (hookId, putApiV4HooksHookId, params = {}) => this.request({
      path: `/api/v4/hooks/${hookId}`,
      method: "PUT",
      body: putApiV4HooksHookId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a test run for a webhook. Executes the webhook with mock data.
    *
    * @tags hooks
    * @name PostApiV4HooksHookId
    * @summary Create a test run
    * @request POST:/api/v4/hooks/{hook_id}
    */
    postApiV4HooksHookId: (hookId, params = {}) => this.request({
      path: `/api/v4/hooks/${hookId}`,
      method: "POST",
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Deletes a specified system hook. Administrators only.
    *
    * @tags hooks
    * @name DeleteApiV4HooksHookId
    * @summary Delete a system hook
    * @request DELETE:/api/v4/hooks/{hook_id}
    */
    deleteApiV4HooksHookId: (hookId, params = {}) => this.request({
      path: `/api/v4/hooks/${hookId}`,
      method: "DELETE",
      format: "json",
      ...params
    }),
    /**
    * @description Get Unleash features
    *
    * @tags unleash
    * @name GetApiV4FeatureFlagsUnleashProjectId
    * @request GET:/api/v4/feature_flags/unleash/{project_id}
    */
    getApiV4FeatureFlagsUnleashProjectId: (projectId, query, params = {}) => this.request({
      path: `/api/v4/feature_flags/unleash/${projectId}`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Deprecated in GitLab 15.6
    *
    * @tags unleash
    * @name GetApiV4FeatureFlagsUnleashProjectIdFeatures
    * @summary Get a list of features (v2 client support)
    * @request GET:/api/v4/feature_flags/unleash/{project_id}/features
    * @deprecated
    */
    getApiV4FeatureFlagsUnleashProjectIdFeatures: (projectId, query, params = {}) => this.request({
      path: `/api/v4/feature_flags/unleash/${projectId}/features`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Get a list of features
    *
    * @tags unleash
    * @name GetApiV4FeatureFlagsUnleashProjectIdClientFeatures
    * @request GET:/api/v4/feature_flags/unleash/{project_id}/client/features
    */
    getApiV4FeatureFlagsUnleashProjectIdClientFeatures: (projectId, query, params = {}) => this.request({
      path: `/api/v4/feature_flags/unleash/${projectId}/client/features`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Register Unleash client
    *
    * @tags unleash
    * @name PostApiV4FeatureFlagsUnleashProjectIdClientRegister
    * @request POST:/api/v4/feature_flags/unleash/{project_id}/client/register
    */
    postApiV4FeatureFlagsUnleashProjectIdClientRegister: (projectId, postApiV4FeatureFlagsUnleashProjectIdClientRegister, params = {}) => this.request({
      path: `/api/v4/feature_flags/unleash/${projectId}/client/register`,
      method: "POST",
      body: postApiV4FeatureFlagsUnleashProjectIdClientRegister,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Report Unleash client metrics
    *
    * @tags unleash
    * @name PostApiV4FeatureFlagsUnleashProjectIdClientMetrics
    * @request POST:/api/v4/feature_flags/unleash/{project_id}/client/metrics
    */
    postApiV4FeatureFlagsUnleashProjectIdClientMetrics: (projectId, postApiV4FeatureFlagsUnleashProjectIdClientMetrics, params = {}) => this.request({
      path: `/api/v4/feature_flags/unleash/${projectId}/client/metrics`,
      method: "POST",
      body: postApiV4FeatureFlagsUnleashProjectIdClientMetrics,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 13.4.
    *
    * @tags usage_data
    * @name PostApiV4UsageDataIncrementCounter
    * @summary Track usage data event
    * @request POST:/api/v4/usage_data/increment_counter
    */
    postApiV4UsageDataIncrementCounter: (postApiV4UsageDataIncrementCounter, params = {}) => this.request({
      path: `/api/v4/usage_data/increment_counter`,
      method: "POST",
      body: postApiV4UsageDataIncrementCounter,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Track usage data event for the current user
    *
    * @tags usage_data
    * @name PostApiV4UsageDataIncrementUniqueUsers
    * @request POST:/api/v4/usage_data/increment_unique_users
    */
    postApiV4UsageDataIncrementUniqueUsers: (postApiV4UsageDataIncrementUniqueUsers, params = {}) => this.request({
      path: `/api/v4/usage_data/increment_unique_users`,
      method: "POST",
      body: postApiV4UsageDataIncrementUniqueUsers,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Tracks one or more GitLab internal events in a single request. Each event increments Service Ping counters in Redis and is optionally sent to Snowplow. This feature was introduced in GitLab 17.3.
    *
    * @tags usage_data
    * @name PostApiV4UsageDataTrackEvents
    * @summary Track multiple internal GitLab events
    * @request POST:/api/v4/usage_data/track_events
    */
    postApiV4UsageDataTrackEvents: (postApiV4UsageDataTrackEvents, params = {}) => this.request({
      path: `/api/v4/usage_data/track_events`,
      method: "POST",
      body: postApiV4UsageDataTrackEvents,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Downloads all metric definitions as a single YAML file.
    *
    * @tags metrics
    * @name GetApiV4UsageDataMetricDefinitions
    * @summary Download metric definitions
    * @request GET:/api/v4/usage_data/metric_definitions
    */
    getApiV4UsageDataMetricDefinitions: (query, params = {}) => this.request({
      path: `/api/v4/usage_data/metric_definitions`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Retrieves the Service Ping payload from the application cache as JSON. If no cached payload is available, returns an empty response. Requires a personal access token with the `read_service_ping` scope. Introduced in GitLab 16.9.
    *
    * @tags usage_data
    * @name GetApiV4UsageDataServicePing
    * @summary Retrieve Service Ping payload
    * @request GET:/api/v4/usage_data/service_ping
    */
    getApiV4UsageDataServicePing: (params = {}) => this.request({
      path: `/api/v4/usage_data/service_ping`,
      method: "GET",
      ...params
    }),
    /**
    * @description Tracks a GitLab internal event. This action increments Service Ping counters in Redis and is optionally sent to Snowplow. Introduced in GitLab 16.2.
    *
    * @tags usage_data
    * @name PostApiV4UsageDataTrackEvent
    * @summary Track an internal GitLab event
    * @request POST:/api/v4/usage_data/track_event
    */
    postApiV4UsageDataTrackEvent: (postApiV4UsageDataTrackEvent, params = {}) => this.request({
      path: `/api/v4/usage_data/track_event`,
      method: "POST",
      body: postApiV4UsageDataTrackEvent,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Lists all non-SQL metrics data used in the Service ping. This action is behind the `usage_data_non_sql_metrics` feature flag. Administrators only.
    *
    * @tags usage_data
    * @name GetApiV4UsageDataNonSqlMetrics
    * @summary List all non-SQL metrics
    * @request GET:/api/v4/usage_data/non_sql_metrics
    */
    getApiV4UsageDataNonSqlMetrics: (params = {}) => this.request({
      path: `/api/v4/usage_data/non_sql_metrics`,
      method: "GET",
      ...params
    }),
    /**
    * @description Lists all raw SQL queries used to compute Service Ping. This action is behind the `usage_data_queries_api` feature flag. Administrators only.
    *
    * @tags usage_data
    * @name GetApiV4UsageDataQueries
    * @summary List all Service Ping SQL queries
    * @request GET:/api/v4/usage_data/queries
    */
    getApiV4UsageDataQueries: (params = {}) => this.request({
      path: `/api/v4/usage_data/queries`,
      method: "GET",
      ...params
    }),
    /**
    * @description Assigned open issues, assigned MRs and pending todos count
    *
    * @tags users
    * @name GetApiV4UserCounts
    * @summary Return the user specific counts
    * @request GET:/api/v4/user_counts
    */
    getApiV4UserCounts: (params = {}) => this.request({
      path: `/api/v4/user_counts`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Create a new runner
    *
    * @tags users, runners
    * @name PostApiV4UserRunners
    * @summary Create a runner owned by currently authenticated user
    * @request POST:/api/v4/user/runners
    */
    postApiV4UserRunners: (postApiV4UserRunners, params = {}) => this.request({
      path: `/api/v4/user/runners`,
      method: "POST",
      body: postApiV4UserRunners,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description List the current limits of a plan on the GitLab instance.
    *
    * @tags plan_limits
    * @name GetApiV4ApplicationPlanLimits
    * @summary Get current plan limits
    * @request GET:/api/v4/application/plan_limits
    */
    getApiV4ApplicationPlanLimits: (query, params = {}) => this.request({
      path: `/api/v4/application/plan_limits`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Modify the limits of a plan on the GitLab instance.
    *
    * @tags plan_limits
    * @name PutApiV4ApplicationPlanLimits
    * @summary Change plan limits
    * @request PUT:/api/v4/application/plan_limits
    */
    putApiV4ApplicationPlanLimits: (putApiV4ApplicationPlanLimits, params = {}) => this.request({
      path: `/api/v4/application/plan_limits`,
      method: "PUT",
      body: putApiV4ApplicationPlanLimits,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Get the current appearance
    *
    * @tags instance
    * @name GetApiV4ApplicationAppearance
    * @request GET:/api/v4/application/appearance
    */
    getApiV4ApplicationAppearance: (params = {}) => this.request({
      path: `/api/v4/application/appearance`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Modify appearance
    *
    * @tags instance
    * @name PutApiV4ApplicationAppearance
    * @request PUT:/api/v4/application/appearance
    */
    putApiV4ApplicationAppearance: (data, params = {}) => this.request({
      path: `/api/v4/application/appearance`,
      method: "PUT",
      body: data,
      type: "multipart/form-data" /* FormData */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the current application statistics for this GitLab instance.
    *
    * @tags instance
    * @name GetApiV4ApplicationStatistics
    * @summary Retrieve application statistics
    * @request GET:/api/v4/application/statistics
    */
    getApiV4ApplicationStatistics: (params = {}) => this.request({
      path: `/api/v4/application/statistics`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all certificate-based clusters associated with a project. This feature was introduced in GitLab 17.9.
    *
    * @tags clusters
    * @name GetApiV4DiscoverCertBasedClusters
    * @summary List all certificate-based clusters
    * @request GET:/api/v4/discover-cert-based-clusters
    */
    getApiV4DiscoverCertBasedClusters: (query, params = {}) => this.request({
      path: `/api/v4/discover-cert-based-clusters`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all deploy keys for the instance.
    *
    * @tags deploy_resources
    * @name GetApiV4DeployKeys
    * @summary List all deploy keys
    * @request GET:/api/v4/deploy_keys
    */
    getApiV4DeployKeys: (query, params = {}) => this.request({
      path: `/api/v4/deploy_keys`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a deploy key for the GitLab instance. Requires administrator access.
    *
    * @tags deploy_resources
    * @name PostApiV4DeployKeys
    * @summary Create a deploy key
    * @request POST:/api/v4/deploy_keys
    */
    postApiV4DeployKeys: (postApiV4DeployKeys, params = {}) => this.request({
      path: `/api/v4/deploy_keys`,
      method: "POST",
      body: postApiV4DeployKeys,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Lists all deploy tokens for the instance.
    *
    * @tags deploy_resources
    * @name GetApiV4DeployTokens
    * @summary List all deploy tokens
    * @request GET:/api/v4/deploy_tokens
    */
    getApiV4DeployTokens: (query, params = {}) => this.request({
      path: `/api/v4/deploy_tokens`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Imports a repository from Bitbucket Cloud to GitLab. Prerequisites: - The prerequisites for Bitbucket Cloud importer. This feature was introduced in GitLab 17.0.
    *
    * @tags project_import
    * @name PostApiV4ImportBitbucket
    * @summary Import repository from Bitbucket Cloud
    * @request POST:/api/v4/import/bitbucket
    */
    postApiV4ImportBitbucket: (postApiV4ImportBitbucket, params = {}) => this.request({
      path: `/api/v4/import/bitbucket`,
      method: "POST",
      body: postApiV4ImportBitbucket,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Imports a repository from Bitbucket Server to GitLab. The Bitbucket Project Key is only used for finding the repository in Bitbucket. You must specify a `target_namespace` if you want to import the repository to a GitLab group.
    *
    * @tags project_import
    * @name PostApiV4ImportBitbucketServer
    * @summary Import repository from Bitbucket Server
    * @request POST:/api/v4/import/bitbucket_server
    */
    postApiV4ImportBitbucketServer: (postApiV4ImportBitbucketServer, params = {}) => this.request({
      path: `/api/v4/import/bitbucket_server`,
      method: "POST",
      body: postApiV4ImportBitbucketServer,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Imports a repository from GitHub to GitLab.
    *
    * @tags project_import
    * @name PostApiV4ImportGithub
    * @summary Import a repository from GitHub
    * @request POST:/api/v4/import/github
    */
    postApiV4ImportGithub: (postApiV4ImportGithub, params = {}) => this.request({
      path: `/api/v4/import/github`,
      method: "POST",
      body: postApiV4ImportGithub,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Cancels an in-progress import of a GitHub project to GitLab.
    *
    * @tags project_import
    * @name PostApiV4ImportGithubCancel
    * @summary Cancel a GitHub project import
    * @request POST:/api/v4/import/github/cancel
    */
    postApiV4ImportGithubCancel: (postApiV4ImportGithubCancel, params = {}) => this.request({
      path: `/api/v4/import/github/cancel`,
      method: "POST",
      body: postApiV4ImportGithubCancel,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Imports personal GitHub gists into GitLab snippets. You can import gists with up to 10 files. GitHub gists with more than 10 files are skipped. You should manually migrate these GitHub gists. If any gists cannot be imported, an email is sent with a list of gists that were not imported.
    *
    * @tags imports
    * @name PostApiV4ImportGithubGists
    * @summary Import GitHub gists into GitLab snippets
    * @request POST:/api/v4/import/github/gists
    */
    postApiV4ImportGithubGists: (postApiV4ImportGithubGists, params = {}) => this.request({
      path: `/api/v4/import/github/gists`,
      method: "POST",
      body: postApiV4ImportGithubGists,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Triggers a global slack command.
    *
    * @tags integrations
    * @name PostApiV4SlackTrigger
    * @summary Trigger a global slack command
    * @request POST:/api/v4/slack/trigger
    */
    postApiV4SlackTrigger: (postApiV4SlackTrigger, params = {}) => this.request({
      path: `/api/v4/slack/trigger`,
      method: "POST",
      body: postApiV4SlackTrigger,
      type: "application/json" /* Json */,
      ...params
    }),
    /**
    * @description Retrieves statistics for issues accessible by the currently authenticated user. By default, returns only issues created by the current user. To get all issues, set the `scope` attribute to `all`.
    *
    * @tags issues
    * @name GetApiV4IssuesStatistics
    * @summary Retrieve issues statistics for the currently authenticated user
    * @request GET:/api/v4/issues_statistics
    */
    getApiV4IssuesStatistics: (query, params = {}) => this.request({
      path: `/api/v4/issues_statistics`,
      method: "GET",
      query,
      ...params
    }),
    /**
    * @description Retrieves metadata information for the GitLab instance.
    *
    * @tags metadata
    * @name GetApiV4Metadata
    * @summary Retrieve metadata information for this GitLab instance
    * @request GET:/api/v4/metadata
    */
    getApiV4Metadata: (params = {}) => this.request({
      path: `/api/v4/metadata`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description This feature was introduced in GitLab 8.13 and deprecated in 15.5. We recommend you instead use the Metadata API.
    *
    * @tags metadata
    * @name GetApiV4Version
    * @summary Retrieves version information for the GitLab instance
    * @request GET:/api/v4/version
    */
    getApiV4Version: (params = {}) => this.request({
      path: `/api/v4/version`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Lists all project topics sorted by the number of associated projects.
    *
    * @tags project_topics
    * @name GetApiV4Topics
    * @summary List all topics
    * @request GET:/api/v4/topics
    */
    getApiV4Topics: (query, params = {}) => this.request({
      path: `/api/v4/topics`,
      method: "GET",
      query,
      format: "json",
      ...params
    }),
    /**
    * @description Creates a project topic. Administrators only.
    *
    * @tags project_topics
    * @name PostApiV4Topics
    * @summary Create a project topic
    * @request POST:/api/v4/topics
    */
    postApiV4Topics: (postApiV4Topics, params = {}) => this.request({
      path: `/api/v4/topics`,
      method: "POST",
      body: postApiV4Topics,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves a specified project topic.
    *
    * @tags project_topics
    * @name GetApiV4TopicsId
    * @summary Retrieve a topic
    * @request GET:/api/v4/topics/{id}
    */
    getApiV4TopicsId: (id, params = {}) => this.request({
      path: `/api/v4/topics/${id}`,
      method: "GET",
      format: "json",
      ...params
    }),
    /**
    * @description Updates a specified project topic. Administrators only.
    *
    * @tags project_topics
    * @name PutApiV4TopicsId
    * @summary Update a project topic
    * @request PUT:/api/v4/topics/{id}
    */
    putApiV4TopicsId: (id, putApiV4TopicsId, params = {}) => this.request({
      path: `/api/v4/topics/${id}`,
      method: "PUT",
      body: putApiV4TopicsId,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Deletes a specified project topic. Administrators only.
    *
    * @tags project_topics
    * @name DeleteApiV4TopicsId
    * @summary Delete a project topic
    * @request DELETE:/api/v4/topics/{id}
    */
    deleteApiV4TopicsId: (id, params = {}) => this.request({
      path: `/api/v4/topics/${id}`,
      method: "DELETE",
      ...params
    }),
    /**
    * @description Merges a source topic into a target topic. This action deletes the source topic and moves all assigned projects to the target topic. Administrators only.
    *
    * @tags project_topics
    * @name PostApiV4TopicsMerge
    * @summary Merge topics
    * @request POST:/api/v4/topics/merge
    */
    postApiV4TopicsMerge: (postApiV4TopicsMerge, params = {}) => this.request({
      path: `/api/v4/topics/merge`,
      method: "POST",
      body: postApiV4TopicsMerge,
      type: "application/json" /* Json */,
      format: "json",
      ...params
    }),
    /**
    * @description Retrieves the GitLab public key for signing web commits. This feature was introduced in GitLab 17.4.
    *
    * @tags web_commits
    * @name GetApiV4WebCommitsPublicKey
    * @summary Retrieve the public signing key
    * @request GET:/api/v4/web_commits/public_key
    */
    getApiV4WebCommitsPublicKey: (params = {}) => this.request({
      path: `/api/v4/web_commits/public_key`,
      method: "GET",
      ...params
    })
  };
}
export {
  Api,
  ContentType,
  HttpClient
};
