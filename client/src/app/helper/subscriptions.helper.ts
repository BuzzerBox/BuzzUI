import {Subscription} from 'rxjs';

export class SubscriptionsHelper {
  private constructor() {
  }

  public static cleanUpSubscriptions(...subs: Subscription[]): void {
    for (let sub of subs) {
      if (sub != null) {
        sub.unsubscribe();
        sub = null;
      }
    }
  }
}
