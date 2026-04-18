(function () {
  const { useEffect, useMemo, useState } = React;

  const api = async (path, options = {}) => {
    const token = localStorage.getItem("token");
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }
    return data;
  };

  const emptyEvent = {
    title: "",
    description: "",
    location: "",
    eventDate: "",
    seatLimit: 25,
  };

  function App() {
    const [authMode, setAuthMode] = useState("login");
    const [authForm, setAuthForm] = useState({
      name: "",
      email: "",
      password: "",
      role: "user",
    });
    const [user, setUser] = useState(() => {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    });
    const [events, setEvents] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [eventForm, setEventForm] = useState(emptyEvent);
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const registeredEventIds = useMemo(() => {
      return new Set(
        registrations
          .map((registration) => registration.eventId && (registration.eventId._id || registration.eventId))
          .filter(Boolean)
      );
    }, [registrations]);

    const showMessage = (text) => {
      setMessage(text);
      setError("");
    };

    const showError = (text) => {
      setError(text);
      setMessage("");
    };

    const loadEvents = async () => {
      const data = await api("/api/events");
      setEvents(data.events || []);
    };

    const loadRegistrations = async () => {
      if (!localStorage.getItem("token")) {
        setRegistrations([]);
        return;
      }
      const data = await api("/api/registrations/me");
      setRegistrations(data.registrations || []);
    };

    useEffect(() => {
      loadEvents().catch((err) => showError(err.message));
    }, []);

    useEffect(() => {
      if (user) {
        loadRegistrations().catch((err) => showError(err.message));
      } else {
        setRegistrations([]);
      }
    }, [user]);

    const submitAuth = async (event) => {
      event.preventDefault();
      setLoading(true);
      try {
        const path = authMode === "login" ? "/api/auth/login" : "/api/auth/signup";
        const payload =
          authMode === "login"
            ? { email: authForm.email, password: authForm.password }
            : authForm;
        const data = await api(path, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
        setAuthForm({ name: "", email: "", password: "", role: "user" });
        showMessage(`Welcome, ${data.user.name}`);
      } catch (err) {
        showError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const logout = () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setRegistrations([]);
      showMessage("Logged out");
    };

    const submitEvent = async (event) => {
      event.preventDefault();
      setLoading(true);
      try {
        const payload = {
          ...eventForm,
          seatLimit: Number(eventForm.seatLimit),
        };
        const path = editingId ? `/api/events/${editingId}` : "/api/events";
        await api(path, {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
        setEventForm(emptyEvent);
        setEditingId(null);
        await loadEvents();
        showMessage(editingId ? "Event updated" : "Event created");
      } catch (err) {
        showError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const startEditing = (event) => {
      setEditingId(event._id);
      setEventForm({
        title: event.title,
        description: event.description,
        location: event.location,
        eventDate: new Date(event.eventDate).toISOString().slice(0, 16),
        seatLimit: event.seatLimit,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const deleteEvent = async (eventId) => {
      if (!confirm("Delete this event and its registrations?")) {
        return;
      }
      setLoading(true);
      try {
        await api(`/api/events/${eventId}`, { method: "DELETE" });
        await loadEvents();
        await loadRegistrations();
        showMessage("Event deleted");
      } catch (err) {
        showError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const register = async (eventId) => {
      setLoading(true);
      try {
        await api(`/api/registrations/${eventId}`, { method: "POST" });
        await loadEvents();
        await loadRegistrations();
        showMessage("Registration confirmed");
      } catch (err) {
        showError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const cancelRegistration = async (eventId) => {
      setLoading(true);
      try {
        await api(`/api/registrations/${eventId}`, { method: "DELETE" });
        await loadEvents();
        await loadRegistrations();
        showMessage("Registration cancelled");
      } catch (err) {
        showError(err.message);
      } finally {
        setLoading(false);
      }
    };

    return React.createElement(
      "main",
      { className: "shell" },
      React.createElement(Header, { user, logout }),
      React.createElement(Status, { message, error }),
      !user &&
        React.createElement(AuthPanel, {
          authMode,
          setAuthMode,
          authForm,
          setAuthForm,
          submitAuth,
          loading,
        }),
      user &&
        user.role === "admin" &&
        React.createElement(AdminPanel, {
          eventForm,
          setEventForm,
          editingId,
          setEditingId,
          submitEvent,
          loading,
        }),
      React.createElement(EventList, {
        user,
        events,
        registeredEventIds,
        startEditing,
        deleteEvent,
        register,
        cancelRegistration,
        loading,
      }),
      user &&
        React.createElement(MyRegistrations, {
          registrations,
          cancelRegistration,
          loading,
        })
    );
  }

  function Header({ user, logout }) {
    return React.createElement(
      "header",
      { className: "topbar" },
      React.createElement(
        "div",
        null,
        React.createElement("p", { className: "eyebrow" }, "Event Management System"),
        React.createElement("h1", null, "Plan, publish, and book events")
      ),
      user
        ? React.createElement(
            "div",
            { className: "account" },
            React.createElement("span", null, `${user.name} (${user.role})`),
            React.createElement("button", { onClick: logout, className: "secondary" }, "Logout")
          )
        : React.createElement("p", { className: "hint" }, "Sign in to register or manage events")
    );
  }

  function Status({ message, error }) {
    if (!message && !error) return null;
    return React.createElement("div", { className: error ? "alert error" : "alert success" }, error || message);
  }

  function AuthPanel({ authMode, setAuthMode, authForm, setAuthForm, submitAuth, loading }) {
    return React.createElement(
      "section",
      { className: "panel auth-panel" },
      React.createElement(
        "div",
        { className: "tabs" },
        React.createElement(
          "button",
          { className: authMode === "login" ? "active" : "", onClick: () => setAuthMode("login") },
          "Login"
        ),
        React.createElement(
          "button",
          { className: authMode === "signup" ? "active" : "", onClick: () => setAuthMode("signup") },
          "Signup"
        )
      ),
      React.createElement(
        "form",
        { onSubmit: submitAuth, className: "grid-form" },
        authMode === "signup" &&
          React.createElement("input", {
            placeholder: "Name",
            value: authForm.name,
            onChange: (event) => setAuthForm({ ...authForm, name: event.target.value }),
            required: true,
          }),
        React.createElement("input", {
          placeholder: "Email",
          type: "email",
          value: authForm.email,
          onChange: (event) => setAuthForm({ ...authForm, email: event.target.value }),
          required: true,
        }),
        React.createElement("input", {
          placeholder: "Password",
          type: "password",
          value: authForm.password,
          onChange: (event) => setAuthForm({ ...authForm, password: event.target.value }),
          required: true,
          minLength: 6,
        }),
        authMode === "signup" &&
          React.createElement(
            "select",
            {
              value: authForm.role,
              onChange: (event) => setAuthForm({ ...authForm, role: event.target.value }),
            },
            React.createElement("option", { value: "user" }, "User"),
            React.createElement("option", { value: "admin" }, "Admin")
          ),
        React.createElement("button", { disabled: loading }, authMode === "login" ? "Login" : "Create account")
      )
    );
  }

  function AdminPanel({ eventForm, setEventForm, editingId, setEditingId, submitEvent, loading }) {
    return React.createElement(
      "section",
      { className: "panel" },
      React.createElement("h2", null, editingId ? "Edit event" : "Create event"),
      React.createElement(
        "form",
        { onSubmit: submitEvent, className: "grid-form event-form" },
        React.createElement("input", {
          placeholder: "Title",
          value: eventForm.title,
          onChange: (event) => setEventForm({ ...eventForm, title: event.target.value }),
          required: true,
        }),
        React.createElement("input", {
          placeholder: "Location",
          value: eventForm.location,
          onChange: (event) => setEventForm({ ...eventForm, location: event.target.value }),
          required: true,
        }),
        React.createElement("input", {
          type: "datetime-local",
          value: eventForm.eventDate,
          onChange: (event) => setEventForm({ ...eventForm, eventDate: event.target.value }),
          required: true,
        }),
        React.createElement("input", {
          type: "number",
          min: "1",
          value: eventForm.seatLimit,
          onChange: (event) => setEventForm({ ...eventForm, seatLimit: event.target.value }),
          required: true,
        }),
        React.createElement("textarea", {
          placeholder: "Description",
          value: eventForm.description,
          onChange: (event) => setEventForm({ ...eventForm, description: event.target.value }),
          required: true,
        }),
        React.createElement(
          "div",
          { className: "actions" },
          React.createElement("button", { disabled: loading }, editingId ? "Save changes" : "Create event"),
          editingId &&
            React.createElement(
              "button",
              {
                type: "button",
                className: "secondary",
                onClick: () => {
                  setEditingId(null);
                  setEventForm(emptyEvent);
                },
              },
              "Cancel"
            )
        )
      )
    );
  }

  function EventList({
    user,
    events,
    registeredEventIds,
    startEditing,
    deleteEvent,
    register,
    cancelRegistration,
    loading,
  }) {
    return React.createElement(
      "section",
      { className: "events-section" },
      React.createElement("div", { className: "section-heading" }, React.createElement("h2", null, "Events")),
      events.length === 0
        ? React.createElement("p", { className: "muted" }, "No events yet.")
        : React.createElement(
            "div",
            { className: "events-grid" },
            events.map((event) => {
              const availableSeats = Math.max(event.seatLimit - event.seatsBooked, 0);
              const registered = registeredEventIds.has(event._id);
              return React.createElement(
                "article",
                { className: "event-card", key: event._id },
                React.createElement("div", { className: "date-pill" }, formatDate(event.eventDate)),
                React.createElement("h3", null, event.title),
                React.createElement("p", { className: "muted" }, event.location),
                React.createElement("p", null, event.description),
                React.createElement(
                  "div",
                  { className: "seat-row" },
                  React.createElement("span", null, `${availableSeats} seats left`),
                  React.createElement("span", null, `${event.seatsBooked}/${event.seatLimit} booked`)
                ),
                React.createElement(
                  "div",
                  { className: "actions" },
                  user &&
                    user.role === "user" &&
                    (registered
                      ? React.createElement(
                          "button",
                          { className: "secondary", disabled: loading, onClick: () => cancelRegistration(event._id) },
                          "Cancel registration"
                        )
                      : React.createElement(
                          "button",
                          { disabled: loading || availableSeats === 0, onClick: () => register(event._id) },
                          availableSeats === 0 ? "Full" : "Register"
                        )),
                  user &&
                    user.role === "admin" &&
                    React.createElement(
                      React.Fragment,
                      null,
                      React.createElement("button", { className: "secondary", onClick: () => startEditing(event) }, "Edit"),
                      React.createElement("button", { className: "danger", onClick: () => deleteEvent(event._id) }, "Delete")
                    ),
                  !user && React.createElement("span", { className: "muted" }, "Login to register")
                )
              );
            })
          )
    );
  }

  function MyRegistrations({ registrations, cancelRegistration, loading }) {
    return React.createElement(
      "section",
      { className: "panel" },
      React.createElement("h2", null, "My registrations"),
      registrations.length === 0
        ? React.createElement("p", { className: "muted" }, "No registrations yet.")
        : React.createElement(
            "div",
            { className: "registration-list" },
            registrations.map((registration) => {
              const event = registration.eventId;
              if (!event) return null;
              return React.createElement(
                "div",
                { className: "registration-item", key: registration._id },
                React.createElement("div", null, React.createElement("strong", null, event.title), React.createElement("p", null, formatDate(event.eventDate))),
                React.createElement(
                  "button",
                  { className: "secondary", disabled: loading, onClick: () => cancelRegistration(event._id) },
                  "Cancel"
                )
              );
            })
          )
    );
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
})();
