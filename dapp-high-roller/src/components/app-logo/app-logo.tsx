import { Component } from "@stencil/core";

@Component({
  tag: "app-logo",
  styleUrl: "app-logo.scss",
  shadow: true
})
export class AppLogo {
  render() {
    return (
      <div>
        <stencil-route-link url="/wager">
          <div class="wrapper wrapper--welcome clickable">
            <div class="welcome">
              <h1 class="welcome__logo">
                <img src="/assets/images/logo.svg" alt="High Roller" />
              </h1>
            </div>
          </div>
        </stencil-route-link>
      </div>
    );
  }
}
